import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function ProfilePhotoStep({ onBack, onComplete, loading, initialPhoto = "" }) {
  const [photoDataUrl, setPhotoDataUrl] = useState(initialPhoto);
  const [error, setError] = useState("");

  useEffect(() => {
    setPhotoDataUrl(initialPhoto);
  }, [initialPhoto]);

  const resizeImageToDataUrl = (file, maxSize = 512, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement("canvas");

          let { width, height } = img;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas is not supported"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl);
        };

        img.onerror = () => reject(new Error("Unable to process image"));
        img.src = reader.result?.toString() || "";
      };

      reader.onerror = () => reject(new Error("Unable to read file"));
      reader.readAsDataURL(file);
    });

  const onPickPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    // 8 MB raw file limit before compression
    if (file.size > 8 * 1024 * 1024) {
      setError("That image is too large. Please choose a smaller photo.");
      return;
    }

    try {
      const compressed = await resizeImageToDataUrl(file, 512, 0.75);
      setPhotoDataUrl(compressed);
    } catch (err) {
      console.error("Unable to prepare image", err);
      setError("We couldn't process that image. Please try a different one.");
    }
  };

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#edf5f6] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="flex justify-center gap-2 pb-2">
          <span className="h-2 w-8 rounded-full bg-teal-500" />
          <span className="h-2 w-8 rounded-full bg-teal-500" />
        </div>

        <h2 className="text-center text-4xl font-extrabold tracking-tight text-slate-800">
          Add a profile photo
        </h2>
        <p className="text-center text-lg text-slate-500">
          Help the community recognize you in chat.
        </p>

        <div className="flex justify-center py-2">
          <label className="flex h-40 w-40 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-slate-300 bg-white text-slate-500">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-6 text-center text-sm font-semibold">
                Upload photo
              </span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700"
        >
          Back
        </button>

        <button
          type="button"
          onClick={() => onComplete(photoDataUrl)}
          disabled={!photoDataUrl || loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-xl font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : "Finish"}
        </button>
      </div>
    </div>
  );
}

export default ProfilePhotoStep;
