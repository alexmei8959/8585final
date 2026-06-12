from rest_framework import serializers


class UanModelSerializer(serializers.ModelSerializer):
    """
    所有自動帶入 create_user / last_modified_user 的 serializer 都繼承這個。
    自動加上 read_only_fields 避免使用者傳入。
    """

    def get_fields(self):
        fields = super().get_fields()
        # 自動設為 read_only，如果欄位存在
        for field_name in ["create_user", "last_modified_user"]:
            if field_name in fields:
                fields[field_name].read_only = True
        return fields