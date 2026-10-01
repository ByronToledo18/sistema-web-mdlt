import type React from "react"
export default function CatalogoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="catalog-theme font-[family-name:var(--font-catalog)]">{children}</div>
}
