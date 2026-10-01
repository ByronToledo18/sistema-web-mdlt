"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Los filtros de los listados del admin viven en la URL (?q=…&inactivos=1):
// el Server Component los lee y vuelve a consultar. Cambiar un filtro es un
// router.replace dentro de una transición, así la lista anterior sigue en
// pantalla mientras llega la nueva.
export function useUrlFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const setFilters = (updates: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  return { searchParams, setFilters, isPending }
}

// Texto de búsqueda con estado local inmediato y escritura en la URL con
// debounce, para no consultar en cada tecla.
export function useDebouncedSearch(param = "q", delay = 300) {
  const { searchParams, setFilters, isPending } = useUrlFilters()
  const [value, setValue] = useState(searchParams.get(param) ?? "")
  const setFiltersRef = useRef(setFilters)
  setFiltersRef.current = setFilters

  useEffect(() => {
    if (value.trim() === (searchParams.get(param) ?? "")) return
    const timeout = setTimeout(() => setFiltersRef.current({ [param]: value.trim() || null }), delay)
    return () => clearTimeout(timeout)
  }, [value, param, delay, searchParams])

  return { value, setValue, isPending }
}
