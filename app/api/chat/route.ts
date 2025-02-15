import { DataAPIClient } from "@datastax/astra-db-ts"
import { HfInference } from "@huggingface/inference"
import { formatDataStreamPart } from "ai"

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  HUGGINGFACE_INFERENCE_TOKEN,
} = process.env

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE })

const embedModelID = "BAAI/bge-large-en-v1.5"
const genModelID = "meta-llama/Llama-3.2-3B-Instruct"

export const runtime = "edge" // Ensure this API route runs on the Edge runtime
export const maxDuration = 60 // Allow streaming responses up to 60 seconds

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const latestMessage = messages[messages?.length - 1]?.content

    let docContext = ""

    const embeddingInference = new HfInference(HUGGINGFACE_INFERENCE_TOKEN)
    const embedResult = (await embeddingInference.featureExtraction({
      model: embedModelID,
      inputs: latestMessage,
    })) as number[]
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
    If the context doesn't include the information you need, answer based on your existing knowledge and don't mention the source of your information. Also, don't mention what the context. Format responses using markdown where applicable and don't return images.
    ------------------
    START CONTEXT
    ${docContext}
    END CONTEXT
    ------------------
    QUESTION: ${latestMessage}
    ------------------
	`,
    }
    const generationInference = new HfInference(HUGGINGFACE_INFERENCE_TOKEN)
    const stream = generationInference.chatCompletionStream({
      model: genModelID,
      messages: [template, ...messages],
    })
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const content = chunk.choices[0].delta.content
            if (content) {
              // Serialize the StreamPart to JSON and enqueue it
              controller.enqueue(
                new TextEncoder().encode(formatDataStreamPart("text", content))
              )
            }
          }
        }
        controller.close()
      },
    })
    return new Response(readableStream)
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}
