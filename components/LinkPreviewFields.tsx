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

  const [lastFetched, setLastFetched] = useState(url || "");

  /** `overwrite` is true for the explicit button; automatic fetches only fill empty fields. */
  async function fetchPreview(overwrite: boolean) {
    if (!values.url || !previewEnabled) return;
    if (!overwrite && values.url === lastFetched) return;
    if (!/^https?:\/\//i.test(values.url)) {
      if (overwrite) setStatus("Previews work for http(s) links only.");
      return;
    }
    setLastFetched(values.url);
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
        title: overwrite || !current.title ? data.title || current.title : current.title,
        description: overwrite || !current.description ? data.description || current.description : current.description,
        imageUrl: overwrite || !current.imageUrl ? data.imageUrl || current.imageUrl : current.imageUrl
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
            onBlur={previewEnabled ? () => void fetchPreview(false) : undefined}
          />
          {previewEnabled ? (
            <button className="btn-secondary shrink-0" type="button" onClick={() => void fetchPreview(true)} title="Fetch title and image" aria-label="Fetch title and image from URL">
              <Wand2 size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {status ? <span className="text-xs text-black/55" role="status">{status}</span> : null}
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
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary owner-provided preview
              <img src={values.imageUrl} alt="" className="h-20 w-20 rounded object-cover" />
            )}
            <ImagePlus size={18} className="text-black/40" />
          </div>
        </div>
      ) : null}
    </>
  );
}
