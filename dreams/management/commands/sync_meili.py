from django.core.management.base import BaseCommand

from dreams.models import dream
from dreams.search import configure_index, _build_document


class Command(BaseCommand):
    help = "將所有夢境全量同步至 Meilisearch 索引"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=200,
            help="每批同步筆數（預設 200）",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]

        self.stdout.write("設定 Meilisearch 索引屬性...")
        configure_index()
        self.stdout.write(self.style.SUCCESS("索引屬性設定完成"))

        import meilisearch
        from django.conf import settings
        client = meilisearch.Client(settings.MEILI_URL)
        index = client.index("dreams")

        qs = dream.objects.select_related("user").filter(is_folder=False)
        total = qs.count()
        self.stdout.write(f"共找到 {total} 筆夢境，開始同步...")

        synced = 0
        batch = []
        for obj in qs.iterator(chunk_size=batch_size):
            batch.append(_build_document(obj))
            if len(batch) >= batch_size:
                index.add_documents(batch)
                synced += len(batch)
                self.stdout.write(f"  已同步 {synced}/{total}")
                batch = []

        if batch:
            index.add_documents(batch)
            synced += len(batch)

        self.stdout.write(self.style.SUCCESS(f"同步完成，共 {synced} 筆。"))
