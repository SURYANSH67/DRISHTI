import json
import os
import math
from typing import List, Dict, Any, Optional
from pathlib import Path
from app.config import settings

class SimpleVectorStore:
    def __init__(self, index_name: str = "vector_store.json"):
        self.file_path = settings.CHROMA_DIR / index_name
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.load()

    def load(self):
        """Load index from JSON file."""
        if self.file_path.exists():
            try:
                with open(self.file_path, "r") as f:
                    self.documents = json.load(f)
                print(f"Loaded {len(self.documents)} vectors from {self.file_path}")
            except Exception as e:
                print(f"Error loading vector index: {e}")
                self.documents = {}
        else:
            self.documents = {}

    def save(self):
        """Save index to JSON file."""
        try:
            with open(self.file_path, "w") as f:
                json.dump(self.documents, f)
        except Exception as e:
            print(f"Error saving vector index: {e}")

    def add_documents(self, docs: List[Dict[str, Any]]):
        """
        Add list of documents to store.
        Each doc: {"id": str, "text": str, "embedding": List[float], "metadata": Dict[str, Any]}
        """
        for doc in docs:
            doc_id = doc["id"]
            self.documents[doc_id] = {
                "id": doc_id,
                "text": doc["text"],
                "embedding": doc["embedding"],
                "metadata": doc.get("metadata", {})
            }
        self.save()

    def delete_by_book(self, book_id: str):
        """Delete all documents associated with a book ID."""
        to_delete = []
        for doc_id, doc in self.documents.items():
            if doc.get("metadata", {}).get("book_id") == book_id:
                to_delete.append(doc_id)
        for doc_id in to_delete:
            self.documents.pop(doc_id, None)
        if to_delete:
            self.save()

    def search(
        self, 
        query_embedding: List[float], 
        k: int = 5, 
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for top k most similar documents.
        Filters can match key-value pairs (e.g. {"book_id": "...", "chapter_number": 2})
        """
        results = []
        
        # Precompute query norm (should be 1.0 for OpenAI embeddings, but let's be safe)
        query_norm = math.sqrt(sum(q * q for q in query_embedding))
        if query_norm == 0:
            query_norm = 1.0

        for doc_id, doc in self.documents.items():
            # Check metadata filters
            metadata = doc.get("metadata", {})
            matches = True
            if filter_metadata:
                for fk, fv in filter_metadata.items():
                    # For list filters or specific matches
                    if fk == "chapter_number" and fv is not None:
                        # Handle string vs integer match
                        val = metadata.get(fk)
                        if val is not None and int(val) != int(fv):
                            matches = False
                            break
                    elif metadata.get(fk) != fv:
                        matches = False
                        break
            
            if not matches:
                continue

            doc_emb = doc["embedding"]
            if not doc_emb or len(doc_emb) != len(query_embedding):
                continue
                
            # Dot product
            dot_prod = sum(q * d for q, d in zip(query_embedding, doc_emb))
            doc_norm = math.sqrt(sum(d * d for d in doc_emb))
            if doc_norm == 0:
                doc_norm = 1.0
                
            similarity = dot_prod / (query_norm * doc_norm)
            
            results.append({
                "id": doc.get("id"),
                "text": doc.get("text"),
                "metadata": metadata,
                "score": similarity
            })

        # Sort by similarity score descending
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:k]

vector_store = SimpleVectorStore()
