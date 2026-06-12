from rest_framework import serializers
from Dreamstream.serializers import UanModelSerializer
from .models import dream, dream_reply, dream_follow, dream_hashtag, dream_image


def _get_avatar_url(user):
    """取得 user 的頭像 URL；無頭像或無 userprofile 時回傳 None。"""
    try:
        if user:
            return user.userprofile.avatar_url
    except Exception:
        pass
    return None


class DreamSerializer(UanModelSerializer):
    user_username = serializers.SerializerMethodField()
    user_avatar   = serializers.SerializerMethodField()
    follow_count  = serializers.SerializerMethodField()
    is_followed   = serializers.SerializerMethodField()
    reply_count   = serializers.SerializerMethodField()
    hashtags      = serializers.SerializerMethodField()
    image_url     = serializers.SerializerMethodField()
    image_id      = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    def get_user_username(self, obj):
        return obj.user.first_name if obj.user else None

    def get_user_avatar(self, obj):
        return _get_avatar_url(obj.user)

    def get_follow_count(self, obj):
        return len(obj.follows.all())

    def get_is_followed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return any(f.user_id == request.user.pk for f in obj.follows.all())

    def get_reply_count(self, obj):
        return len(obj.replies.all())

    def get_hashtags(self, obj):
        return [h.hashtag for h in obj.hashtags.all()]

    def get_image_url(self, obj):
        images = obj.images.all()
        img = images[0] if images else None
        if img and img.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(img.image.url)
        return None

    def get_image_id(self, obj):
        images = obj.images.all()
        img = images[0] if images else None
        return str(img.id) if img else None

    def get_children_count(self, obj):
        if obj.is_folder:
            return len(obj.children.all())
        return 0

    class Meta:
        model = dream
        fields = "__all__"


class DreamFollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = dream_follow
        fields = ["id", "dream"]


class DreamReplySerializer(UanModelSerializer):
    user_username = serializers.SerializerMethodField()
    user_avatar   = serializers.SerializerMethodField()

    def get_user_username(self, obj):
        return obj.user.first_name if obj.user else None

    def get_user_avatar(self, obj):
        return _get_avatar_url(obj.user)

    class Meta:
        model = dream_reply
        fields = "__all__"
        extra_kwargs = {
            # reply_date 由 viewset 的 perform_create 自動填入
            "reply_date": {"required": False},
        }


class DreamImageSerializer(UanModelSerializer):
    class Meta:
        model = dream_image
        fields = "__all__"
