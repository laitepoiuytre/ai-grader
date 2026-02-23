
import React, { useState, useCallback, DragEvent } from 'react';
import { UploadIcon, CloseIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (files: File[]) => void;
  imageUrls: string[];
  onImageRemove: (index: number) => void;
  disabled: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, imageUrls, onImageRemove, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      onImageUpload(Array.from(files));
    }
  };

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled) {
      const files = e.dataTransfer.files;
      handleFileChange(files);
    }
  }, [disabled, handleFileChange]);

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-2 text-center transition-all duration-300 ease-in-out h-full flex flex-col
        ${isDragging ? 'border-brand-secondary bg-brand-dark/50' : 'border-brand-primary/40 hover:border-brand-secondary/80'}
        ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        id="file-input"
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileChange(e.target.files)}
        disabled={disabled}
        multiple
      />
      {imageUrls.length > 0 ? (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-brand-primary">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {imageUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square group">
                            <img src={url} alt={`Preview ${index + 1}`} className="object-cover h-full w-full rounded border border-brand-primary/20" />
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(!disabled) onImageRemove(index);
                                }}
                                className="absolute top-1 right-1 bg-brand-dark/80 text-white rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-500 transition-all z-10"
                                aria-label="Remove image"
                            >
                                <CloseIcon className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div 
                onClick={() => !disabled && document.getElementById('file-input')?.click()}
                className="py-2 text-xs text-brand-secondary hover:underline cursor-pointer flex justify-center items-center gap-2 border-t border-brand-primary/10 shrink-0"
            >
                <UploadIcon className="w-3 h-3" />
                <span>点击添加更多图片...</span>
            </div>
        </div>
      ) : (
        <div 
            className="flex flex-col items-center justify-center gap-3 text-brand-subtext cursor-pointer flex-grow py-4"
            onClick={() => !disabled && document.getElementById('file-input')?.click()}
        >
          <UploadIcon className="w-10 h-10" />
          <div>
            <p className="font-semibold text-sm">
                <span className="text-brand-secondary">点击上传</span> 或 拖拽至此处
            </p>
            <p className="text-[10px] opacity-70 mt-1">支持 PNG, JPG 等图片格式</p>
          </div>
        </div>
      )}
    </div>
  );
};
