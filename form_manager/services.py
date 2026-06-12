import json
from pathlib import Path
from typing import Dict, Any, List

from django.conf import settings

from .models import form_template
from .pipeline import PipelineFactory

import logging

logger = logging.getLogger(__name__)


class OcrService:
    """
    Service/Facade Layer.
    Responsible for fetching configuration and delegating to the correct pipeline.

    Parameters
    - client_id: str
      Client identifier. It typically becomes the folder name to isolate inputs/outputs/temp files and audit logs.
      Will be sanitized to allow only letters, digits, underscore, and hyphen.
    - model_name: Literal["gemini", "paddle"]
      OCR model strategy:
        - "gemini": cloud API suited for complex layouts/multilingual/high accuracy; requires GEMINI_API_KEY
        - "paddle": on-prem/local, low cost/offline; requires paddleocr installed
    Methods
    - run(image_path: str) -> Dict[str, Any]
      Execute OCR via the selected pipeline and return a normalized result.
    """

    def __init__(self, client_id, model_name, template_name):
        self.client_id = client_id
        self.model_name = model_name
        self.parser_structure = self._load_parser_structure(template_name=template_name)

        # Initialize the appropriate pipeline strategy
        self.pipeline = PipelineFactory.get_pipeline(model_name, self.parser_structure)

    def _load_parser_structure(
        self, template_name="兒童牙科門診 兒童口腔狀況評估表（初診）"
    ):
        """
        load configuration from DB.
        Replace with actual ORM calls.
        """
        form_templates = form_template.objects.filter(name=template_name)
        if form_templates.exists():
            form_templates = form_templates.first()
            return form_templates.json
        else:
            raise ValueError(f"No parser structure found for {template_name}")

    def process(self, files: List) -> Dict[str, Any]:
        """
        Main entry point for the service.
        """
        # Delegate execution to the pipeline
        try:
            return self.pipeline.run(files)
        except Exception as e:
            logger.error(f"Primary OCR model ({self.model_name}) failed: {e}")
            # fallback model
            fallback_model = "paddle" if self.model_name == "gemini" else "gemini"
            self.pipeline = PipelineFactory.get_pipeline(fallback_model, self.parser_structure)
            try:
                return self.pipeline.run(files)
            except Exception as e:
                logger.error(f"Fallback OCR model ({self.model_name}) failed: {e}")
