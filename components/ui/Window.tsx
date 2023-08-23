"use client"
import { twMerge } from "tailwind-merge"
import {
  HTMLMotionProps,
  motion,
  useDragControls,
  useMotionValue,
} from "framer-motion"
import { Button } from "./Button"
import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { Slot } from "@radix-ui/react-slot"

type WindowsMap = Map<
  string,
  {
    layer: number
    name: string
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
    fullScreen: boolean
    setFullScreen: React.Dispatch<React.SetStateAction<boolean>>
  }
>

type WindowContext = {
  windows: WindowsMap
  setWindows: React.Dispatch<React.SetStateAction<WindowsMap>>
}

type Boundry = {
  top: number
  left: number
  right: number
  bottom: number
}

type WindowBoundryContext = {
  constraints: Boundry | undefined
}

const WindowContext = createContext<WindowContext | null>(null)
const WindowConstraintsContext = createContext<WindowBoundryContext | null>(
  null
)

function useWindowContext() {
  const context = useContext(WindowContext)

  if (context === null) {
    throw new Error("not in window context")
  }

  return context
}

function useWindowConstraints() {
  const context = useContext(WindowConstraintsContext)
  return useMemo(() => {
    if (!window) return undefined
    if (!context?.constraints)
      return {
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      }

    return context.constraints
  }, [])
}

export function useWindows() {
  const { windows, setWindows } = useWindowContext()
  function getWindowsControlls() {
    return [...windows.keys()].map((id) => {
      const win = windows.get(id)
      if (!win) throw new Error("key exist but no window data of given id")
      return { ...win, id }
    })
  }
  function focusWindow(id: string) {
    const win = windows.get(id)
    if (!win) return
    const oldLayer = win.layer
    win.layer = windows.size

    windows.forEach((w, key) => {
      if (key === id) return
      if (w.layer > oldLayer) w.layer -= 1
    })

    setWindows(new Map(windows))
  }

  return { getWindowsControlls, focusWindow }
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState(new Map())

  return (
    <WindowContext.Provider value={{ windows, setWindows }}>
      {children}
    </WindowContext.Provider>
  )
}

export function Window({
  children,
  className,
  name,
  defaultOpen = true,
  defaultFullScreen = false,
  asChild = false,
  onClose,
  onPointerDown,
  customId = undefined,
  ...props
}: HTMLMotionProps<"div"> & {
  customId?: string
  name: string
  defaultOpen?: boolean
  defaultFullScreen?: boolean
  children?: React.ReactElement
  asChild?: boolean
  onClose?: (id: string) => void
}) {
  const dragControlls = useDragControls()
  const { windows, setWindows } = useWindowContext()
  const i = useId()
  const id = customId ?? i
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(defaultOpen)
  const [fullScreen, setFullScreen] = useState(defaultFullScreen)
  const layer = useMemo(() => {
    const w = windows.get(id)
    if (!w) return
    return w.layer
  }, [windows, id])

  function putWindowOnTop() {
    const win = windows.get(id)
    if (!win) return
    const oldLayer = win.layer
    win.layer = windows.size

    windows.forEach((w, key) => {
      if (key === id) return
      if (w.layer > oldLayer) w.layer -= 1
    })

    setWindows(new Map(windows))
  }

  useEffect(() => {
    setWindows(
      new Map(
        windows.set(id, {
          layer: windows.size + 1,
          name,
          open,
          setOpen,
          fullScreen,
          setFullScreen,
        })
      )
    )
  }, [open, fullScreen, windows, id])

  useEffect(
    () => () => {
      const s = windows.delete(id)
      if (s) setWindows(new Map(windows))
      else throw new Error("no window with given id")
    },
    [windows]
  )

  const c = useWindowConstraints()
  const constraints = c
    ? ref.current
      ? {
          top: c.top,
          left: c.left,
          right: c.right - ref.current.clientWidth,
          bottom: c.bottom - ref.current.clientHeight,
        }
      : {
          top: c.top,
          left: c.left,
          right: c.right - 400,
          bottom: c.bottom - 300,
        }
    : undefined

  const x = useMotionValue(400)
  const y = useMotionValue(300)

  if (!open) return null

  return (
    <motion.div
      className="border-outset border-2 border-zinc-300 select-none"
      layoutId={id}
      ref={ref}
      drag={!fullScreen}
      dragControls={dragControlls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={constraints}
      style={{
        position: "absolute",
        minWidth: "400px",
        minHeight: "300px",
        inset: fullScreen ? 0 : "",
        x: fullScreen ? 0 : x,
        y: fullScreen ? 0 : y,
        zIndex: layer,
      }}
      {...props}
      onPointerDown={(e) => {
        putWindowOnTop()
        onPointerDown && onPointerDown(e)
      }}
    >
      <nav
        className={twMerge(
          "flex select-none flex-row justify-between items-center w-full border-outset border-b-2 bg-gray-400",
          className
        )}
        onPointerDown={(e) => dragControlls.start(e)}
      >
        <h3 className="text-zinc-800 pl-2 text-xl font-bold">{name}</h3>
        <section className="flex gap-x-1 pr-1 py-1">
          <Button
            className="border-2 border-outset font-bold w-[28px]"
            onClick={() => {
              setOpen(false)
              if (ref.current) {
                const b = ref.current.getBoundingClientRect()
                x.set(b.left)
                y.set(b.top)
              }
            }}
          >
            __
          </Button>
          <Button
            className="border-2 border-outset"
            onClick={() => setFullScreen((o) => !o)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M2 4h20v16H2V4zm18 14V6H4v12h16z" fill="currentColor" />
              <path
                d="M2 4h20v16H2V4zm2 14h16V6H4v12zM8 8h2v2H8v2H6V8h2zm8 8h-2v-2h2v-2h2v4h-2z"
                fill="currentColor"
              />
            </svg>
          </Button>
          {onClose ? (
            <Button
              className="border-2 border-outset"
              onClick={() => onClose(id)}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <path
                  d="M5 5h2v2H5V5zm4 4H7V7h2v2zm2 2H9V9h2v2zm2 0h-2v2H9v2H7v2H5v2h2v-2h2v-2h2v-2h2v2h2v2h2v2h2v-2h-2v-2h-2v-2h-2v-2zm2-2v2h-2V9h2zm2-2v2h-2V7h2zm0 0V5h2v2h-2z"
                  fill="currentColor"
                />
              </svg>
            </Button>
          ) : null}
        </section>
      </nav>
      <Slot>{children}</Slot>
    </motion.div>
  )
}

export function WindowsContainer({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const [constraints, setConstraints] = useState<Boundry | undefined>(undefined)

  useEffect(() => {
    if (ref.current) {
      setConstraints(ref.current.getBoundingClientRect())
    }
  }, [])
  return (
    <WindowConstraintsContext.Provider value={{ constraints }}>
      <div {...props} className={twMerge("relative", className)} ref={ref}>
        {children}
      </div>
    </WindowConstraintsContext.Provider>
  )
}
