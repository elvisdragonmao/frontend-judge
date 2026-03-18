import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  onUpload: (files: File[]) => void;
  isLoading?: boolean;
}

export function FileUploader({ onUpload, isLoading }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setSelectedFiles(files);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
    }
  }, [selectedFiles, onUpload]);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoading) {
        setIsDragging(true);
      }
    },
    [isLoading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (isLoading) return;

      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) {
        setSelectedFiles(files);
      }
    },
    [isLoading],
  );

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="text-sm font-medium">拖曳檔案到這裡上傳</p>
        <p className="mt-1 text-xs text-muted-foreground">
          也可使用下方按鈕選擇檔案或資料夾
        </p>
      </div>

      <div className="flex gap-2">
        {/* Single / multiple file upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          選擇檔案
        </Button>

        {/* Folder upload */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is a non-standard attribute
          webkitdirectory=""
          // @ts-ignore directory is a non-standard attribute
          directory=""
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => folderInputRef.current?.click()}
          disabled={isLoading}
        >
          選擇資料夾
        </Button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            已選擇 {selectedFiles.length} 個檔案
          </p>
          <div className="max-h-40 overflow-auto rounded border border-border p-2">
            {selectedFiles.map((file, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                {file.webkitRelativePath || file.name}{" "}
                <span className="text-muted-foreground/60">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ))}
          </div>
          <Button size="sm" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "上傳中..." : "提交作業"}
          </Button>
        </div>
      )}
    </div>
  );
}
