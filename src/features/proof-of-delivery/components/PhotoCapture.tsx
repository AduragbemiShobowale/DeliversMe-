import { useState } from "react";
import { supabase } from "../../../shared/lib/supabase";
import { Button } from "../../../shared/components";

interface PhotoCaptureProps {
  businessId: string;
  deliveryId: string;
  onUploaded: (url: string) => void;
}

/**
 * Uploads to the private proof-of-delivery bucket at
 * businessId/deliveryId/filename -- matching exactly the path shape the
 * storage RLS policies (0020) parse. Client-side compression is a
 * documented gap here (Stage 15's recommendation), not yet implemented --
 * flagged in this pass's final report rather than silently skipped.
 */
export function PhotoCapture({ businessId, deliveryId, onUploaded }: PhotoCaptureProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    const path = `${businessId}/${deliveryId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("proof-of-delivery").upload(path, file);
    setUploading(false);
    if (uploadError) {
      setError("Upload failed. Try again — your photo hasn't been lost.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    // Store the permanent storage PATH, not a signed URL -- signed URLs
    // expire (this one would have silently broken every old delivery's
    // proof after 30 days if stored directly). Signed URLs are generated
    // fresh at display time instead -- see resolvePodUrl().
    onUploaded(path);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
        id="pod-photo-input"
      />
      {preview ? (
        <img src={preview} alt="Proof of delivery" className="mb-2 h-40 w-full rounded-[var(--radius-control)] object-cover" />
      ) : (
        <label htmlFor="pod-photo-input">
          <div className="mb-2 flex h-40 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-strong)] text-sm text-[var(--color-text-muted)]">
            {uploading ? "Uploading…" : "Tap to take a photo"}
          </div>
        </label>
      )}
      {error && (
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-danger)]">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => document.getElementById("pod-photo-input")?.click()}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
