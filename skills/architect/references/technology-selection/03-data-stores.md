# Data Stores

Choosing storage by data lifecycle and query shape: relational as the default source of truth; search/analytical/vector as read models. Use for primary-storage selection, read/write splitting, RAG storage design, and judging when to split stores.

## Do not make one database carry every problem

At MVP, one relational store carrying transactions, reports, search, attachments, and vectors is fine. The problem arrives when the business grows and these data classes diverge completely in access pattern: orders need strong consistency and zero loss; reports scan masses of history without dragging the primary store; search needs relevance ranking, not `LIKE`; images and video need cheap storage with CDN delivery; RAG needs vector recall plus permission filtering.

The architectural judgment is not "which database is best" but **which storage model should carry which data class**. A system often needs several stores, but each one adds synchronization paths, consistency boundaries, operational work, and debugging cost.

## Draw the data lifecycle first

Before choosing a database, draw one data class from birth to archive: write → validate → commit → query/retrieve → analyze/report → archive/delete. Answer five questions:

- Whether reads or writes dominate decides read/write splitting, caching, and the index model.
- The transaction boundary decides whether relational transactions can enclose the work.
- The query shape decides everything: primary-key lookup, range, full-text, and vector similarity are completely different.
- How fast the data grows decides partitioning, hot/cold tiering, and archiving.
- What happens on corruption decides consistency, backup, audit, and recovery levels.

Size the data, the read/write ratio, and the retention period before talking tools.

## Relational as the default primary storage

- Relational stores such as PostgreSQL and MySQL fit transactions, orders, permissions, tenants, and ledgers, data that needs transactions. They do not fit extreme-scale analytics, full-text search, or masses of unstructured files.
- Document stores such as MongoDB fit frequently changing structure, whole-document reads and writes, and weakly related data. They do not fit strong transactions, complex multi-table joins, or strict reporting.
- Key-value stores such as DynamoDB and persistent Redis fit high-speed key reads and writes, simple structure, and extreme scale. They do not fit complex queries or flexible joins.
- Columnar and analytical stores such as ClickHouse and BigQuery fit reports, aggregation, log analysis, and behavior analysis. They do not fit high-frequency small transactional writes.

Default advice: first stabilize core transactional data in a relational store; only when reports, search, logs, or vector retrieval genuinely become independent pressure do you split out the corresponding read model. Do not stuff each data class into a different database on day one for the sake of modernity.

## Read models are not accessories of the primary store

When the query shape departs from what the primary store is good at, consider a read model:

- Full-text search engines such as Elasticsearch, OpenSearch, and Meilisearch buy relevance and inverted indexes. The price is index-sync maintenance and eventual consistency.
- Report analytics engines such as ClickHouse, BigQuery, and Snowflake make columnar scans and aggregation fast, but cannot carry transactional writes.
- Object storage such as S3, OSS, and GCS stores files cheaply and durably, but do not query it like a database.
- Vector databases such as Milvus, Qdrant, and pgvector give strong similarity retrieval, but permission filtering, recall quality, and cost need evaluation.
- Time-series databases such as Prometheus and InfluxDB are strong for metric-timeline queries, not for ordinary business objects.

The easiest mistake is treating the read model as the source of truth. The correct relation: primary store = source of truth; search/analytical/vector stores = read models synced from the primary store or object storage. A read model may lag, but you must state clearly **how long it may lag, how to compensate, and how to rebuild**. A user updating their profile writing only to the search index while the primary store knows nothing—that is an incident.

## A vector store is not the only answer for RAG

RAG easily gets flattened into "chunk documents → vector store → topK → LLM answers". A real system also includes: raw-text object storage, parsing and chunking, a metadata primary store, a keyword index (hybrid retrieval), and permission/tenant filtering.

Ask when selecting: is permission filtering done before or after retrieval (post-filtering may under-recall)? Vector-only or hybrid retrieval? Where do raw text and citations live (the vector store should not be the sole source of truth)? If the index breaks, can it be rebuilt from raw text and metadata? Can cost grow linearly with document count and query volume?

A vector store solves similarity recall; it does not solve permissions, source of truth, citations, or evaluation. Do not flatten a RAG system into one store.

## Trigger signals for splitting stores

- When report queries slow the transactional store (OLTP/OLAP interference), sync the data to an analytical store.
- When search relevance is poor and LIKE scans are slow, build a search index.
- When attachments or images bloat the database, move them to object storage and a CDN.
- When a single table grows enough to slow indexes and backups, partition it, archive it, or separate hot and cold data.
- When RAG recall is unstable, use hybrid retrieval, reranking, and eval.

The counter-case: with small data, a small team, and low failure cost, one relational store with sane indexes and regular backups is often healthier than prematurely introducing five stores.

## How to write the selection conclusion

The key is stating clearly **which read model was crushing which source of truth**, not "ClickHouse is fast". Example: context—monthly reports scanning 200 million rows of historical events, transactional P99 rising from 120ms to 900ms; choice—the primary store remains the source of truth, Outbox events sync to an analytical store, reports query only the analytical store; given up—strong real-time reporting, allowing up to 1 minute of lag; gained—isolation of the transactional path from the reporting path; re-review conditions—when reports must become second-level real-time or sync lag exceeds business tolerance, re-evaluate.

## Relationship to other documents

- The consistency engineering of read-model lag and compensation is in [Consistency](../09-consistency.md).
- The general principles of data and state design are in [Data ownership](../05-data-ownership.md).
- The unified selection decision tree is in [Selection principles](./01-principles.md).
- The overall design of RAG systems is in [AI system design](../ai/02-ai-system-design.md).
