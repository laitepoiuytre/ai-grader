
import React, { useState, useCallback, DragEvent } from 'react';
import { DocumentTextIcon, CloseIcon } from './icons';

interface AnswerFileUploaderProps {
  onFileUpload: (file: File) => void;
  file: File | null;
  onFileRemove: () => void;
  disabled: boolean;
}

export const AnswerFileUploader: React.FC<AnswerFileUploaderProps> = ({ onFileUpload, file, onFileRemove, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileUpload(files[0]);
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
      className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 ease-in-out flex flex-col justify-center h-28
        ${isDragging ? 'border-brand-secondary bg-brand-dark/50' : 'border-brand-primary/40 hover:border-brand-secondary/80'}
        ${disabled ? 'cursor-not-allowed opacity-60' : 'bg-brand-dark'}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        id="answer-file-input"
        type="file"
        className="hidden"
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        onChange={(e) => handleFileChange(e.target.files)}
        disabled={disabled}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3 text-brand-text">
            <DocumentTextIcon className="w-6 h-6 text-green-400" />
            <span className="font-medium truncate">{file.name}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onFileRemove();
                }}
                className="text-brand-subtext hover:text-red-500 transition-colors p-1 rounded-full"
                aria-label="Remove file"
            >
                <CloseIcon className="w-4 h-4" />
            </button>
        </div>
      ) : (
        <div 
            className="flex flex-col items-center justify-center gap-2 text-brand-subtext cursor-pointer"
            onClick={() => !disabled && document.getElementById('answer-file-input')?.click()}
        >
          <DocumentTextIcon className="w-8 h-8" />
          <p className="font-semibold">
            <span className="text-brand-secondary">Click to upload</span> or drag and drop
          </p>
          <p className="text-sm">Standard Answer Key (.xlsx, .csv)</p>
        </div>
      )}
    </div>
  );
};
