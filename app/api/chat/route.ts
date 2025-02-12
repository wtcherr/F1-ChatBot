import { DataAPIClient } from "@datastax/astra-db-ts"
import { LangChainAdapter } from "ai"
import { ChatOllama } from "@langchain/ollama"
import { HfInference } from "@huggingface/inference"

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  HUGGINGFACE_INFERENCE_TOKEN,
} = process.env

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE })

const embedModel = "BAAI/bge-large-en-v1.5"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const latestMessage = messages[messages?.length - 1]?.content

    let docContext = ""

    /* const extractor = await pipeline("feature-extraction", embedModel, {
      device: "gpu",
    })

    const embedding = await extractor([latestMessage], {
      pooling: "mean",
      normalize: true,
    }) */

    const embeddingInference = new HfInference(HUGGINGFACE_INFERENCE_TOKEN)
    const embedResult = await embeddingInference.featureExtraction({
      model: embedModel,
      inputs: latestMessage,
    })
    console.log(embedResult)
    try {
      const collection = await db.collection(ASTRA_DB_COLLECTION)
      const cursor = collection.find(null, {
        sort: {
          $vector: embedResult,
        },
        limit: 10,
      })

      const documents = await cursor.toArray()
      const docsMap = documents?.map((doc) => doc.text)

      docContext = JSON.stringify(docsMap)
    } catch {
      console.log("Error querying db collection...")
    }

    const template = {
      role: "system",
      content: `
    You are an AI assistant who knows everything about Formula One. Use the below context to augment what you know about Formula One Racing. The context will provide you with the most recent page data from wikipedia, the official F1 website and others.
    If the context doesn't include the information you need answer based on your existing knowledge and don't mention the source of your information or what the context does or doesn't include. Format responses using markdown where applicable and don't return images.
    ------------------
    START CONTEXT
    ${docContext}
    END CONTEXT
    ------------------
    QUESTION: ${latestMessage}
    ------------------
	`,
    }
    const ollamaModel = new ChatOllama({
      model: "llama3:latest",
    })
    const stream = await ollamaModel.stream([template, ...messages])
    return LangChainAdapter.toDataStreamResponse(stream)
  } catch (err) {
    console.log(err)
  }
}
