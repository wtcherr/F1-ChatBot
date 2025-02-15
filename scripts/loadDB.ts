import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"
import { pipeline } from "@huggingface/transformers"

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"

import "dotenv/config"

const embedModel = "BAAI/bge-large-en-v1.5"
const embedDim = 1024
const batchSize = 128
const chunkSize = 1024
const chunkOverlap = 128

type SimilarityMetric = "dot_product" | "cosine" | "euclidean"
const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
} = process.env

const f1Data = [
  "https://www.formula1.com/en/racing/2024",
  "https://www.formula1.com/en/results/2024/races",
  "https://www.formula1.com/en/results/2024/team",
  "https://www.formula1.com/en/latest/all",
  "https://en.wikipedia.org/wiki/Formula_One",
  "https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Drivers%27_Champions",
  "https://www.skysports.com/f1/news/12433/13061245/lewis-hamilton-to-join-ferrari-for-2025-formula-1-season",
  "https://www.formula1.com/en/latest/tags/driver-market.48p0PATNawKYyi0QueUwyS",
  "https://www.formula1.com/en/latest/article/2025-f1-grid-all-the-driver-and-team-line-ups-confirmed-so-far.7yijhWBNHjqKwHTRFEMZUa",
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE })

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: chunkSize,
  chunkOverlap: chunkOverlap,
})

const createCollection = async (
  similarityMetric: SimilarityMetric = "dot_product"
) => {
  try {
    // Attempting to get the collection
    await db.collection(ASTRA_DB_COLLECTION)
    await db.dropCollection(ASTRA_DB_COLLECTION)
  } finally {
    // Now, create the collection with vector configuration
    const resCreate = await db.createCollection(ASTRA_DB_COLLECTION, {
      vector: {
        dimension: embedDim,
        metric: similarityMetric,
      },
    })
    console.log(resCreate)
  }
}

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION)
  const extractor = await pipeline("feature-extraction", embedModel, {
    device: "gpu",
  })
  console.log("Extractor found!")
  for await (const url of f1Data) {
    const content = await scrapePage(url)
    const chunks = await splitter.splitText(content)
    let batch = [] // Initialize an empty array to hold batches of processed chunks
    for (let i = 0; i < chunks.length; i++) {
      batch.push(chunks[i])

      if ((i + 1) % batchSize === 0 || i === chunks.length - 1) {
        const embeddings = await extractor(batch, {
          pooling: "mean",
          normalize: true,
        })
        // Create an array of objects with vector and text properties
        const vectorsAndTexts = []

        const numChunks = embeddings.dims[0]

        for (let j = 0; j < numChunks; j++) {
          // Extract the embedding vector for the j-th chunk
          const startIdx = j * embedDim
          const endIdx = startIdx + embedDim
          const embedding = embeddings.data.slice(startIdx, endIdx)
          vectorsAndTexts.push({
            $vector: Array.from(embedding),
            text: batch[j],
          })
        }
        await collection.insertMany(vectorsAndTexts)
        // Reset the batch for next set of chunks
        batch = []
      }
    }
  }
}
const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerText)
      await browser.close()
      return result
    },
  })
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, "")
}

createCollection().then(() => loadSampleData())
