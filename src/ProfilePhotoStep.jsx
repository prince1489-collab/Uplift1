import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

function ProfilePhotoStep({ onBack, onComplete, loading, initialPhoto = "" }) {
  const [photoDataUrl, setPhotoDataUrl] = useState(initialPhoto);

  useEffect(() => {
    setPhotoDataUrl(initialPhoto);
  }, [initialPhoto]);

  const onPickPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result?.toString() || "");
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#edf5f6] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="flex justify-center gap-2 pb-2">
          <span className="h-2 w-8 rounded-full bg-teal-500" />
          <span className="h-2 w-8 rounded-full bg-teal-500" />
        </div>
        <h2 className="text-center text-4xl font-extrabold tracking-tight text-slate-800">Add a profile photo</h2>
        <p className="text-center text-lg text-slate-500">Help the community recognize you in chat.</p>

        <div className="flex justify-center py-2">
          <label className="flex h-40 w-40 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-slate-300 bg-white text-slate-500">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              <span className="px-6 text-center text-sm font-semibold">Upload photo</span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
        </div>

        <button
          onClick={onBack}
          className="w-full rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700"
        >
          Back
        </button>

        <button
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
