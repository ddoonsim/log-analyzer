"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, AlertCircle } from "lucide-react";

interface UploadedFile {
  id: string;
  file: File;
}

interface FileUploaderProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxSize?: number; // bytes
}

const MAX_SIZE_DEFAULT = 500 * 1024 * 1024; // 500MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export default function FileUploader({
  files,
  onChange,
  maxSize = MAX_SIZE_DEFAULT,
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        id: generateId(),
        file,
      }));
      onChange([...files, ...newFiles]);
    },
    [files, onChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      maxSize,
      multiple: true,
    });

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

  return (
    <div className="space-y-4">
      {/* 드롭존 영역 */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/50 hover:bg-card-hover"
        }`}
      >
        <input {...getInputProps()} />
        <Upload
          className={`h-10 w-10 ${isDragActive ? "text-primary" : "text-muted"}`}
        />
        <p className="mt-3 text-sm font-medium">
          {isDragActive ? "파일을 여기에 놓으세요" : "파일을 드래그하거나 클릭하여 선택"}
        </p>
        <p className="mt-1 text-xs text-muted">
          모든 파일 형식 지원 (최대 500MB)
        </p>
      </div>

      {/* 파일 거부 에러 */}
      {fileRejections.length > 0 && (
        <div className="rounded-lg border border-error/50 bg-error/10 p-3">
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle className="h-4 w-4" />
            <span>일부 파일을 추가할 수 없습니다:</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-error/80">
            {fileRejections.map(({ file, errors }) => (
              <li key={file.name}>
                {file.name}:{" "}
                {errors.map((e) => {
                  if (e.code === "file-too-large") return "파일 크기 초과";
                  if (e.code === "file-invalid-type") return "지원하지 않는 형식";
                  return e.message;
                }).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-medium">
              업로드된 파일 ({files.length}개)
            </span>
            <span className="text-xs text-muted">
              총 {formatFileSize(totalSize)}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {files.map(({ id, file }) => (
              <li
                key={id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3 overflow-hidden" data-tooltip={file.name}>
                  <File className="h-4 w-4 shrink-0 text-muted" />
                  <div className="overflow-hidden">
                    <p className="truncate text-sm">{file.name}</p>
                    <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-error/10 hover:text-error"
                  aria-label={`${file.name} 삭제`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
