import { useCallback, useState, useEffect, forwardRef } from "react";
import { FileWithPath, useDropzone } from "react-dropzone";
import { Button } from "../ui/button";

type FileUploaderProps = {
  fieldChange: (files: File[]) => void;
  mediaUrl?: string;
  isAvatar?: boolean;
};

const FileUploader = forwardRef<HTMLDivElement, FileUploaderProps>(
  ({ fieldChange, mediaUrl, isAvatar = false }, ref) => {
    const [file, setFile] = useState<File[]>([]);
    const [fileUrl, setFileUrl] = useState<string>(mediaUrl || "");

    useEffect(() => {
      console.log('FileUploader - mediaUrl changed:', mediaUrl);
      if (mediaUrl) {
        setFileUrl(mediaUrl);
      }
    }, [mediaUrl]);

    const onDrop = useCallback(
      (acceptedFiles: FileWithPath[]) => {
        setFile(acceptedFiles);
        fieldChange(acceptedFiles);
        if (acceptedFiles.length > 0) {
          setFileUrl(URL.createObjectURL(acceptedFiles[0]));
        }
      },
      [file, fieldChange]
    );

    const { getRootProps, getInputProps } = useDropzone({
      onDrop,
      accept: {
        "image/*": [".png", ".jpeg", ".jpg"],
      },
    });

    if (isAvatar) {
      return (
        <div className="flex flex-col items-center gap-4">
          <div
            {...getRootProps()}
            ref={ref}
            className="relative cursor-pointer group"
          >
            <input {...getInputProps()} className="cursor-pointer" />
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-600 hover:border-primary-500 transition-colors">
              {fileUrl ? (
                <img 
                  src={fileUrl} 
                  alt="avatar" 
                  className="w-full h-full object-cover" 
                  key={fileUrl}
                />
              ) : (
                <div className="w-full h-full bg-dark-3 flex items-center justify-center">
                  <img
                    src="/assets/icons/profile-placeholder.svg"
                    width={40}
                    height={40}
                    alt="default avatar"
                    className="opacity-50"
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                <span className="text-white text-xs text-center px-2">点击更换</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        {...getRootProps()}
        ref={ref}
        className="flex flex-center flex-col bg-dark-3 rounded-xl cursor-pointer"
      >
        <input {...getInputProps()} className="cursor-pointer" />

        {fileUrl ? (
          <>
            <div className="flex flex-1 justify-center w-full p-5 lg:p-10">
              <img 
                src={fileUrl} 
                alt="image" 
                className="file_uploader-img object-cover" 
                key={fileUrl} // 添加key确保重新渲染
              />
            </div>
            <p className="file_uploader-label">点击或拖拽照片来替换</p>
          </>
        ) : (
          <div className="file_uploader-box">
            <img
              src="/public/assets/icons/file-upload.svg"
              width={96}
              height={77}
              alt="file upload"
            />

            <h3 className="base-medium text-light-2 mb-2 mt-6">
              拖拽照片到这里
            </h3>
            <p className="text-light-4 small-regular mb-6">SVG, PNG, JPG</p>

            <Button type="button" className="shad-button_dark_4">
              从计算机选择
            </Button>
          </div>
        )}
      </div>
    );
  }
);

FileUploader.displayName = 'FileUploader';

export default FileUploader; 