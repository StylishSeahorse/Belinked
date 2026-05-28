"use client";

import { ImagePlus, Wand2 } from "lucide-react";
import { useState } from "react";

function isVideo(url: string) {
  return /\.(mp4|webm|ogv|ogg|mov)(\?|#|$)/i.test(url);
}

export function LinkPreviewFields({
  title,
  url,
  description,
  imageUrl,
  titleLabel = "Title",
  urlLabel = "URL",
  urlPlaceholder = "https://example.com",
  descriptionLabel = "Description",
  imageLabel = "Image or video URL",
  descriptionRows = 2,
  previewEnabled = true
}: {
  title?: string;
  url?: string;
  description?: string;
  imageUrl?: string;
  titleLabel?: string;
  urlLabel?: string;
  urlPlaceholder?: string;
  descriptionLabel?: string;
  imageLabel?: string;
  descriptionRows?: number;
  previewEnabled?: boolean;
}) {
  const [values, setValues] = useState({
    title: title || "",
    url: url || "",
    description: description || "",
    imageUrl: imageUrl || ""
  });
  const [status, setStatus] = useState("");

  async function fetchPreview() {
    if (!values.url || !previewEnabled) return;
    setStatus("Fetching preview...");
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(values.url)}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(response.status === 401 ? "Sign in again to fetch link previews." : "Preview service returned an unexpected response.");
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not fetch preview.");
      setValues((current) => ({
        ...current,
        title: data.title || current.title,
        description: data.description || current.description,
        imageUrl: data.imageUrl || current.imageUrl
      }));
      setStatus(data.imageUrl ? "Preview added with image." : "Preview added, but this page did not expose a usable image.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not fetch preview.");
    }
  }

  return (
    <>
      <label className="field md:col-span-2">
        {urlLabel}
        <div className="flex gap-2">
          <input
            className="input"
            name="url"
            placeholder={urlPlaceholder}
            value={values.url}
            onChange={(event) => setValues((current) => ({ ...current, url: event.target.value }))}
            onBlur={previewEnabled ? fetchPreview : undefined}
          />
          {previewEnabled ? (
            <button className="btn-secondary shrink-0" type="button" onClick={fetchPreview} title="Fetch title and image">
              <Wand2 size={16} />
            </button>
          ) : null}
        </div>
        {status ? <span className="text-xs text-black/55">{status}</span> : null}
      </label>
      <label className="field">
        {titleLabel}
        <input className="input" name="title" required value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label className="field md:col-span-2">
        {descriptionLabel}
        <textarea className="input" name="description" rows={descriptionRows} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} />
      </label>
      <label className="field">
        {imageLabel}
        <input className="input" name="imageUrl" value={values.imageUrl} onChange={(event) => setValues((current) => ({ ...current, imageUrl: event.target.value }))} />
      </label>
      {values.imageUrl ? (
        <div className="field">
          Media preview
          <div className="flex h-24 items-center gap-3 overflow-hidden rounded-md border border-black/10 bg-white p-2">
            {isVideo(values.imageUrl) ? (
              <video src={values.imageUrl} className="h-20 w-28 rounded object-cover" muted playsInline />
            ) : (
              <img src={values.imageUrl} alt="" className="h-20 w-20 rounded object-cover" />
            )}
            <ImagePlus size={18} className="text-black/40" />
          </div>
        </div>
      ) : null}
    </>
  );
}
