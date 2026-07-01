import pytest
import math
from app.services.vector_store import SimpleVectorStore
from app.config import settings

def test_simple_vector_store():
    # Initialize a test store instance
    store = SimpleVectorStore(index_name="test_vector_store.json")
    
    # Clean previous test entries
    store.documents = {}
    
    # Standard normalized vectors
    # A = [1, 0, 0], B = [0, 1, 0], C = [0.707, 0.707, 0]
    docs = [
        {
            "id": "doc1",
            "text": "Core Physics concepts of electricity.",
            "embedding": [1.0, 0.0, 0.0],
            "metadata": {"book_id": "test_book", "chapter_number": 1, "type": "text"}
        },
        {
            "id": "doc2",
            "text": "Math formula sheet explaining equations.",
            "embedding": [0.0, 1.0, 0.0],
            "metadata": {"book_id": "test_book", "chapter_number": 2, "type": "formula"}
        },
        {
            "id": "doc3",
            "text": "Hybrid visual diagrams and circuits.",
            "embedding": [0.7071, 0.7071, 0.0],
            "metadata": {"book_id": "test_book", "chapter_number": 1, "type": "diagram"}
        }
    ]
    
    # Test adding documents
    store.add_documents(docs)
    assert len(store.documents) == 3
    
    # Test vector search
    # Query is [1.0, 0.0, 0.0] (matching doc1 perfectly)
    results = store.search(query_embedding=[1.0, 0.0, 0.0], k=2)
    assert len(results) == 2
    assert results[0]["id"] == "doc1"
    assert math.isclose(results[0]["score"], 1.0, rel_tol=1e-3)
    
    # Test vector search with chapter filter
    # Search for something related to [0.7071, 0.7071, 0.0] but filter only for chapter 2
    filtered_results = store.search(
        query_embedding=[0.7071, 0.7071, 0.0], 
        k=2, 
        filter_metadata={"book_id": "test_book", "chapter_number": 2}
    )
    assert len(filtered_results) == 1
    assert filtered_results[0]["id"] == "doc2"

    # Test delete by book
    store.delete_by_book("test_book")
    assert len(store.documents) == 0
    
    # Clean up test file
    test_file = settings.CHROMA_DIR / "test_vector_store.json"
    if test_file.exists():
        test_file.unlink()
