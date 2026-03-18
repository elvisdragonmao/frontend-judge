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

  return (
    <div className="space-y-4">
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
