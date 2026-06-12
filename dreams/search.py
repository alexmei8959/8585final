import logging

from django.conf import settings

logger = logging.getLogger("django")

INDEX_NAME = "dreams"

SEARCHABLE_ATTRIBUTES = [
    "title",
    "dream_type",
    "content",
    "interpretation",
    "revelation",
    "user_first_name",
    "hashtags",
]


def _get_client():
    import meilisearch
    return meilisearch.Client(settings.MEILI_URL)


def _build_document(dream_obj):
    dc = dream_obj.dream_content or {}
    if not isinstance(dc, dict):
        dc = {}

    # 收集所有 hashtag
    hashtags_list = list(dream_obj.hashtags.values_list('hashtag', flat=True))
    hashtags_str = " ".join(hashtags_list)  # 合并为单个字符串便于搜索
    logger.info(f"[Dream] 設定hashtag為 {hashtags_str}")

    return {
        "id":              str(dream_obj.id),
        "title":           dream_obj.title or "",
        "dream_type":      dream_obj.dream_type or "",
        "dream_date":      str(dream_obj.dream_date) if dream_obj.dream_date else "",
        "create_user":     dream_obj.create_user or "",
        "user_first_name": dream_obj.user.first_name if dream_obj.user else "",
        "content":         dc.get("內容", "") or "",
        "interpretation":  dc.get("個人解讀/夢語言解釋", "") or "",
        "revelation":      dc.get("禱告方向", "") or "",
        "hashtags":        hashtags_str,
    }


def configure_index():
    """建立或更新索引設定（searchable attributes）。"""
    try:
        client = _get_client()
        client.create_index(INDEX_NAME, {"primaryKey": "id"})
    except Exception:
        pass  # 索引已存在時忽略

    try:
        client = _get_client()
        index = client.index(INDEX_NAME)
        index.update_searchable_attributes(SEARCHABLE_ATTRIBUTES)
    except Exception as e:
        logger.warning("Meilisearch configure_index failed: %s", e)


def index_dream(dream_obj):
    """新增或更新一筆夢境到索引（is_folder=True 時跳過）。"""
    if dream_obj.is_folder:
        return
    try:
        client = _get_client()
        index = client.index(INDEX_NAME)
        index.add_documents([_build_document(dream_obj)])
    except Exception as e:
        logger.warning("Meilisearch index_dream failed (id=%s): %s", dream_obj.id, e)


def delete_dream(dream_id):
    """從索引刪除一筆夢境。"""
    try:
        client = _get_client()
        index = client.index(INDEX_NAME)
        index.delete_document(str(dream_id))
    except Exception as e:
        logger.warning("Meilisearch delete_dream failed (id=%s): %s", dream_id, e)


def search(query, limit=50):
    """
    全文搜尋，回傳依相關性排序的 UUID 字串清單。
    Meilisearch 不可用時拋出例外，由呼叫方降級處理。
    """
    client = _get_client()
    index = client.index(INDEX_NAME)
    result = index.search(query, {"limit": limit})
    return [hit["id"] for hit in result.get("hits", [])]
