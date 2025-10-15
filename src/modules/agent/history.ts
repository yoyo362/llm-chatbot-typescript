import { initGraph } from "../graph";

type UnpersistedChatbotResponse = {
  input: string;
  rephrasedQuestion: string;
  output: string;
  cypher: string | undefined;
};

export type ChatbotResponse = UnpersistedChatbotResponse & {
  id: string;
};

// tag::clear[]
export async function clearHistory(sessionId: string): Promise<void> {
  const graph = await initGraph();
  await graph.query(
    `
    MATCH (s:Session {id: $sessionId})-[:HAS_RESPONSE]->(r)
    DETACH DELETE r
  `,
    { sessionId },
    "WRITE"
  );
}
// end::clear[]

// tag::get[]
export async function getHistory(
  sessionId: string,
  limit: number = 5
): Promise<ChatbotResponse[]> {
  const graph = await initGraph();
  
  const cypher = `
    MATCH (s:Session {id: $sessionId})-[:HAS_RESPONSE]->(r:Response)
    RETURN r.id AS id,
           r.input AS input,
           r.rephrasedQuestion AS rephrasedQuestion,
           r.output AS output,
           r.cypher AS cypher
    ORDER BY r.createdAt DESC
    LIMIT ${limit}
  `;
  
  const res = await graph.query<ChatbotResponse>(
    cypher,
    { sessionId },
    "READ"
  );
  
  return res;
}
// end::get[]

// tag::save[]
/**
 * Save a question and response to the database
 *
 * @param {string} sessionId
 * @param {string} source
 * @param {string} input
 * @param {string} rephrasedQuestion
 * @param {string} output
 * @param {string[]} ids
 * @param {string | null} cypher
 * @returns {string}  The ID of the Message node
 */
export async function saveHistory(
  sessionId: string,
  source: string,
  input: string,
  rephrasedQuestion: string,
  output: string,
  ids: string[],
  cypher: string | null = null
): Promise<string> {
  const graph = await initGraph();
  
  const query = `
    MERGE (s:Session {id: $sessionId})
    CREATE (r:Response {
      id: randomUUID(),
      input: $input,
      rephrasedQuestion: $rephrasedQuestion,
      output: $output,
      cypher: $cypher,
      source: $source,
      createdAt: datetime()
    })
    CREATE (s)-[:HAS_RESPONSE]->(r)
    WITH r
    UNWIND $ids AS contextId
    MATCH (context) WHERE elementId(context) = contextId
    CREATE (r)-[:CONTEXT]->(context)
    RETURN r.id AS id
  `;
  
  const params = {
    sessionId,
    source,
    input,
    rephrasedQuestion,
    output,
    cypher,
    ids
  };
  
  const res = await graph.query<{ id: string }>(query, params, "WRITE");
  
  return res[0].id;
}
// end::save[]
