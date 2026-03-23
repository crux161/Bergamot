"""Schemas for Bergamot instance discovery and feature negotiation."""

from pydantic import BaseModel


class ProductDescriptor(BaseModel):
    name: str
    tagline: str


class ServiceEndpoints(BaseModel):
    http_base_url: str
    api_base_url: str
    websocket_base_url: str
    uploads_base_url: str
    media_base_url: str | None = None
    admin_base_url: str | None = None
    livekit_base_url: str | None = None


class RuntimeConfigRead(BaseModel):
    manifest_version: int
    product: ProductDescriptor
    services: ServiceEndpoints


class FeatureManifestRead(BaseModel):
    manifest_version: int
    product: ProductDescriptor
    capabilities: dict[str, bool]
    routes: dict[str, str]
