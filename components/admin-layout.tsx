"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./dashboard/sidebar"
import { Header } from "./dashboard/header"

interface AdminLayoutProps {
  children: React.ReactNode
  userName: string
  userRole: string
}

export default function AdminLayout({ children, userName, userRole }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar userRole={userRole} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
        <Header userName={userName} userRole={userRole} onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-neutral-50">{children}</main>
      </div>
    </div>
  )
}
