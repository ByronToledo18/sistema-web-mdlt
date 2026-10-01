"use client"

import type React from "react"
import { useState } from "react"
import Image from "next/image"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ImageUploadFieldProps {
  id: string
  label: string
  value: string | null
  onChange: (url: string | null) => void
  onError: (message: string) => void
}

// Sube la imagen a /api/upload (Vercel Blob) y devuelve la URL pública.
export function ImageUploadField({ id, label, value, onChange, onError }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    onError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (!response.ok) {
        onError(data.error)
        return
      }
      onChange(data.url)
    } catch {
      onError("Error al subir la imagen")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative w-full h-48 rounded-md overflow-hidden bg-muted">
          <Image src={value} alt="Preview" fill className="object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-md p-6 text-center">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <Label htmlFor={id} className="cursor-pointer text-sm text-muted-foreground">
            {uploading ? "Subiendo..." : "Click para subir imagen"}
          </Label>
          <Input
            id={id}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={uploading}
          />
        </div>
      )}
    </div>
  )
}
