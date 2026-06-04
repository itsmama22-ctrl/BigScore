"use client";

import { useState, useRef, type ChangeEvent, useEffect } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import {
  Upload,
  ImagePlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Github,
} from "lucide-react";
import {
  uploadImageToGitHubAction,
  isGitHubUploadEnabledAction,
} from "@/app/actions/githubImageUpload";
import { useAuth } from "@/hooks/useAuth";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  path: string;
  accept?: string;
  maxSizeMB?: number;
  aspectRatio?: string;
  label?: string;
  error?: string;
  className?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DEFAULT_MAX_MB = 5;

export function ImageUpload({
  value,
  onChange,
  path,
  accept = ".jpg,.jpeg,.png,.webp",
  maxSizeMB = DEFAULT_MAX_MB,
  aspectRatio,
  label = "Upload Image",
  error,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { adminProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    isGitHubUploadEnabledAction()
      .then(setGithubEnabled)
      .catch(() => setGithubEnabled(false))
      .finally(() => setChecking(false));
  }, []);

  function validateFile(file: File): boolean {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError("Only JPG, PNG, and WebP images are allowed.");
      return false;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`Image must be ${maxSizeMB}MB or smaller.`);
      return false;
    }

    setLocalError(null);
    return true;
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;

    setUploading(true);
    setProgress(0);
    setLocalError(null);

    if (githubEnabled && adminProfile) {
      try {
        setProgress(10);
        const base64 = await fileToBase64(file);
        setProgress(40);

        const result = await uploadImageToGitHubAction({
          base64Content: base64,
          fileName: file.name,
          folder: path,
          actor: {
            uid: adminProfile.uid,
            email: adminProfile.email,
            role: adminProfile.role,
          },
        });

        setProgress(100);

        if (result.success && result.url) {
          onChange(result.url);
        } else {
          setLocalError(result.error || "GitHub upload failed.");
          console.error("[GitHub Upload]", result.error);
        }
      } catch (uploadError) {
        console.error("[ImageUpload GitHub]", uploadError);
        setLocalError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    } else {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const fileRef = ref(storage, `${path}/${Date.now()}.${ext}`);

        const task = uploadBytesResumable(fileRef, file);

        task.on(
          "state_changed",
          (snapshot) => {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setProgress(pct);
          },
          (uploadError) => {
            console.error("[ImageUpload Firebase]", uploadError);
            setLocalError("Upload failed. Please try again.");
            setUploading(false);
          },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            onChange(url);
            setUploading(false);
            setProgress(0);
          }
        );
      } catch (uploadError) {
        console.error("[ImageUpload]", uploadError);
        setLocalError("Upload failed. Please try again.");
        setUploading(false);
      }
    }
  }

  const displayError = error || localError;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-label text-text-secondary">{label}</span>
          {!checking && (
            <span
              className={cn(
                "flex items-center gap-1 text-caption",
                githubEnabled ? "text-accent-green" : "text-text-disabled"
              )}
            >
              <Github className="h-3 w-3" />
              {githubEnabled ? "GitHub" : "Firebase"}
            </span>
          )}
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-border-default bg-bg-tertiary transition-colors hover:border-border-focus hover:bg-bg-elevated",
          aspectRatio,
          value ? "p-0" : "p-8",
          displayError && "border-border-error"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3 p-8">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            <p className="text-body-sm text-text-secondary">
              Uploading... {progress}%
            </p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-bg-primary">
              <div
                className="h-full rounded-full bg-accent-blue transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt="Uploaded"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
              <div className="flex items-center gap-2 rounded-lg bg-bg-primary px-4 py-2">
                <Upload className="h-4 w-4 text-text-primary" />
                <span className="text-body-sm text-text-primary">Change</span>
              </div>
            </div>
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent-green">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="h-8 w-8 text-text-tertiary" />
            <span className="text-body-sm text-text-tertiary">{label}</span>
            <span className="text-caption text-text-disabled">
              JPG, PNG, WebP &middot; Max {maxSizeMB}MB
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          aria-label={label}
        />
      </div>

      {displayError && (
        <p className="flex items-center gap-1 text-caption text-accent-red">
          <AlertCircle className="h-3.5 w-3.5" />
          {displayError}
        </p>
      )}
    </div>
  );
}
