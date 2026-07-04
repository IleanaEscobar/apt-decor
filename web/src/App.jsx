import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const SAVED_LAYOUTS_STORAGE_KEY = 'apt-decor.saved-layouts'

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

function App() {
  const [floorPlan, setFloorPlan] = useState(null)
  const [floorSizeFt, setFloorSizeFt] = useState({ width: 20, height: 15 })
  const [saveName, setSaveName] = useState('')
  const [savedLayoutSearch, setSavedLayoutSearch] = useState('')
  const [savedLayouts, setSavedLayouts] = useState([])
  const [roomGridDraft, setRoomGridDraft] = useState({
    name: '',
    widthFt: 10,
    heightFt: 10,
  })
  const [roomGrids, setRoomGrids] = useState([])
  const [selectedRoomGridId, setSelectedRoomGridId] = useState(null)
  const [furnitureDraft, setFurnitureDraft] = useState({
    name: '',
    widthFt: 6,
    depthFt: 3,
    imageFile: null,
  })
  const [furnitureItems, setFurnitureItems] = useState([])
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null)
  const dragStateRef = useRef(null)
  const stageMetricsRef = useRef({
    renderWidth: 0,
    renderHeight: 0,
    pxPerFtX: 0,
    pxPerFtY: 0,
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_LAYOUTS_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setSavedLayouts(parsed)
      }
    } catch {
      setSavedLayouts([])
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_LAYOUTS_STORAGE_KEY, JSON.stringify(savedLayouts))
    } catch {
      // Ignore storage quota errors so the editor remains usable.
    }
  }, [savedLayouts])

  const stageMetrics = useMemo(() => {
    if (!floorPlan?.naturalWidth || !floorPlan?.naturalHeight) {
      return null
    }

    const maxRenderWidth = 980
    const scale =
      floorPlan.naturalWidth > maxRenderWidth
        ? maxRenderWidth / floorPlan.naturalWidth
        : 1
    const renderWidth = Math.round(floorPlan.naturalWidth * scale)
    const renderHeight = Math.round(floorPlan.naturalHeight * scale)

    const pxPerFtX = floorSizeFt.width > 0 ? renderWidth / floorSizeFt.width : 0
    const pxPerFtY = floorSizeFt.height > 0 ? renderHeight / floorSizeFt.height : 0

    return {
      renderWidth,
      renderHeight,
      pxPerFtX,
      pxPerFtY,
    }
  }, [floorPlan, floorSizeFt.height, floorSizeFt.width])

  useEffect(() => {
    if (!stageMetrics) {
      return
    }

    stageMetricsRef.current = stageMetrics
  }, [stageMetrics])

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!dragStateRef.current) {
        return
      }

      const { id, dragType, startClientX, startClientY, startX, startY } =
        dragStateRef.current
      const dx = event.clientX - startClientX
      const dy = event.clientY - startClientY
      const metrics = stageMetricsRef.current

      if (dragType === 'grid') {
        setRoomGrids((previous) =>
          previous.map((grid) => {
            if (grid.id !== id) {
              return grid
            }

            const widthPx = grid.widthFt * metrics.pxPerFtX
            const heightPx = grid.heightFt * metrics.pxPerFtY
            const maxX = Math.max(metrics.renderWidth - widthPx, 0)
            const maxY = Math.max(metrics.renderHeight - heightPx, 0)

            return {
              ...grid,
              x: Math.min(Math.max(startX + dx, 0), maxX),
              y: Math.min(Math.max(startY + dy, 0), maxY),
            }
          }),
        )
        return
      }

      setFurnitureItems((previous) => {
        return previous.map((item) => {
          if (item.id !== id) {
            return item
          }

          const widthPx = item.widthFt * metrics.pxPerFtX
          const depthPx = item.depthFt * metrics.pxPerFtY

          const maxX = Math.max(metrics.renderWidth - widthPx, 0)
          const maxY = Math.max(metrics.renderHeight - depthPx, 0)

          return {
            ...item,
            x: Math.min(Math.max(startX + dx, 0), maxX),
            y: Math.min(Math.max(startY + dy, 0), maxY),
          }
        })
      })
    }

    const onMouseUp = () => {
      dragStateRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const selectedFurniture = furnitureItems.find((item) => item.id === selectedFurnitureId)
  const filteredSavedLayouts = savedLayouts.filter((layout) =>
    layout.name.toLowerCase().includes(savedLayoutSearch.toLowerCase()),
  )

  const serializeLayout = () => ({
    floorPlan,
    floorSizeFt,
    roomGrids,
    furnitureItems,
  })

  const loadLayout = (layout) => {
    setFloorPlan(layout.floorPlan)
    setFloorSizeFt(layout.floorSizeFt)
    setRoomGrids(layout.roomGrids ?? [])
    setFurnitureItems(layout.furnitureItems ?? [])
    setSelectedRoomGridId(null)
    setSelectedFurnitureId(null)
  }

  const handleSaveLayout = () => {
    if (!saveName.trim() || !floorPlan) {
      return
    }

    const snapshot = serializeLayout()
    const nextLayout = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      updatedAt: new Date().toISOString(),
      ...snapshot,
    }

    setSavedLayouts((previous) => {
      const remaining = previous.filter(
        (layout) => layout.name.toLowerCase() !== nextLayout.name.toLowerCase(),
      )

      return [nextLayout, ...remaining]
    })
    setSaveName('')
  }

  const handleDeleteSavedLayout = (layoutId) => {
    setSavedLayouts((previous) => previous.filter((layout) => layout.id !== layoutId))
  }

  const handleFloorPlanUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const image = new Image()
    const tempUrl = URL.createObjectURL(file)

    image.onload = async () => {
      const dataUrl = await readFileAsDataUrl(file)
      setFloorPlan({
        url: dataUrl,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
      setRoomGrids([])
      setSelectedRoomGridId(null)
      setFurnitureItems([])
      setSelectedFurnitureId(null)
      URL.revokeObjectURL(tempUrl)
    }

    image.src = tempUrl
  }

  const handleAddRoomGrid = (event) => {
    event.preventDefault()
    if (!stageMetrics) {
      return
    }

    const widthFt = Number(roomGridDraft.widthFt)
    const heightFt = Number(roomGridDraft.heightFt)
    const widthPx = widthFt * stageMetrics.pxPerFtX
    const heightPx = heightFt * stageMetrics.pxPerFtY

    const newGrid = {
      id: crypto.randomUUID(),
      name: roomGridDraft.name || `Room ${roomGrids.length + 1}`,
      widthFt,
      heightFt,
      x: Math.max((stageMetrics.renderWidth - widthPx) / 2, 0),
      y: Math.max((stageMetrics.renderHeight - heightPx) / 2, 0),
      colorHue: (roomGrids.length * 47) % 360,
    }

    setRoomGrids((previous) => [...previous, newGrid])
    setSelectedRoomGridId(newGrid.id)
    setRoomGridDraft((previous) => ({
      ...previous,
      name: '',
    }))
  }

  const startDraggingRoomGrid = (event, grid) => {
    event.preventDefault()
    setSelectedRoomGridId(grid.id)
    dragStateRef.current = {
      id: grid.id,
      dragType: 'grid',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: grid.x,
      startY: grid.y,
    }
  }

  const removeSelectedRoomGrid = () => {
    if (!selectedRoomGridId) {
      return
    }

    setRoomGrids((previous) => previous.filter((grid) => grid.id !== selectedRoomGridId))
    setSelectedRoomGridId(null)
  }

  const handleAddFurniture = (event) => {
    event.preventDefault()
    if (!stageMetrics || !furnitureDraft.imageFile) {
      return
    }

    const imageFile = furnitureDraft.imageFile
    const widthPx = furnitureDraft.widthFt * stageMetrics.pxPerFtX
    const depthPx = furnitureDraft.depthFt * stageMetrics.pxPerFtY

    readFileAsDataUrl(imageFile).then((imageUrl) => {
      const newItem = {
        id: crypto.randomUUID(),
        name: furnitureDraft.name || 'Furniture',
        widthFt: Number(furnitureDraft.widthFt),
        depthFt: Number(furnitureDraft.depthFt),
        imageUrl,
        rotation: 0,
        x: Math.max((stageMetrics.renderWidth - widthPx) / 2, 0),
        y: Math.max((stageMetrics.renderHeight - depthPx) / 2, 0),
      }

      setFurnitureItems((previous) => [...previous, newItem])
      setSelectedFurnitureId(newItem.id)
      setFurnitureDraft((previous) => ({ ...previous, imageFile: null, name: '' }))
    })
  }

  const startDraggingFurniture = (event, item) => {
    event.preventDefault()
    setSelectedFurnitureId(item.id)
    dragStateRef.current = {
      id: item.id,
      dragType: 'furniture',
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
    }
  }

  const updateSelectedRotation = (nextRotation) => {
    setFurnitureItems((previous) =>
      previous.map((item) =>
        item.id === selectedFurnitureId
          ? { ...item, rotation: ((nextRotation % 360) + 360) % 360 }
          : item,
      ),
    )
  }

  const rotateSelectedByNinety = () => {
    updateSelectedRotation((selectedFurniture?.rotation ?? 0) + 90)
  }

  const removeSelectedFurniture = () => {
    if (!selectedFurnitureId) {
      return
    }

    setFurnitureItems((previous) =>
      previous.filter((item) => item.id !== selectedFurnitureId),
    )
    setSelectedFurnitureId(null)
  }

  return (
    <main className="planner-page">
      <header className="page-header">
        <h1>Floor Plan Furniture Studio</h1>
        <p>
          Upload a floor plan, calibrate it in feet, then drop furniture images in
          true size, drag them around, and rotate to test layouts.
        </p>
      </header>

      <section className="control-panel">
        <div className="panel-block">
          <h2>1. Floor Plan</h2>
          <label>
            Upload floor plan image
            <input type="file" accept="image/*" onChange={handleFloorPlanUpload} />
          </label>
          <div className="row-two">
            <label>
              Floor width (ft)
              <input
                type="number"
                min="1"
                step="0.1"
                value={floorSizeFt.width}
                onChange={(event) =>
                  setFloorSizeFt((previous) => ({
                    ...previous,
                    width: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Floor height (ft)
              <input
                type="number"
                min="1"
                step="0.1"
                value={floorSizeFt.height}
                onChange={(event) =>
                  setFloorSizeFt((previous) => ({
                    ...previous,
                    height: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="panel-block">
          <h2>Save / Reload</h2>
          <label>
            Save current layout as
            <input
              type="text"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="Ex: Living room layout"
            />
          </label>
          <button type="button" onClick={handleSaveLayout} disabled={!floorPlan || !saveName.trim()}>
            Save Layout
          </button>
          <label>
            Search saved layouts
            <input
              type="text"
              value={savedLayoutSearch}
              onChange={(event) => setSavedLayoutSearch(event.target.value)}
              placeholder="Type a saved layout name"
            />
          </label>
          <div className="saved-layout-list">
            {filteredSavedLayouts.length === 0 ? (
              <p className="hint">No saved layouts match your search.</p>
            ) : (
              filteredSavedLayouts.map((layout) => (
                <div key={layout.id} className="saved-layout-row">
                  <button type="button" onClick={() => loadLayout(layout)}>
                    Load {layout.name}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDeleteSavedLayout(layout.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <form className="panel-block" onSubmit={handleAddRoomGrid}>
          <h2>2. Room Grid Overlay</h2>
          <p className="hint">
            Add one grid per room and drag each grid over the matching room area.
          </p>
          <label>
            Room name
            <input
              type="text"
              value={roomGridDraft.name}
              onChange={(event) =>
                setRoomGridDraft((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Ex: Living Room"
            />
          </label>
          <div className="row-two">
            <label>
              Room width (ft)
              <input
                type="number"
                min="1"
                step="0.1"
                value={roomGridDraft.widthFt}
                onChange={(event) =>
                  setRoomGridDraft((previous) => ({
                    ...previous,
                    widthFt: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
            <label>
              Room height (ft)
              <input
                type="number"
                min="1"
                step="0.1"
                value={roomGridDraft.heightFt}
                onChange={(event) =>
                  setRoomGridDraft((previous) => ({
                    ...previous,
                    heightFt: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
          </div>
          <button type="submit" disabled={!stageMetrics}>
            Add Room Grid
          </button>
          <button
            type="button"
            className="danger"
            onClick={removeSelectedRoomGrid}
            disabled={!selectedRoomGridId}
          >
            Remove Selected Grid
          </button>
        </form>

        <form className="panel-block" onSubmit={handleAddFurniture}>
          <h2>3. Add Furniture</h2>
          <label>
            Furniture name
            <input
              type="text"
              value={furnitureDraft.name}
              onChange={(event) =>
                setFurnitureDraft((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Ex: Sectional Couch"
            />
          </label>
          <label>
            Furniture image
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setFurnitureDraft((previous) => ({
                  ...previous,
                  imageFile: event.target.files?.[0] ?? null,
                }))
              }
              required
            />
          </label>
          <div className="row-two">
            <label>
              Width (ft)
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={furnitureDraft.widthFt}
                onChange={(event) =>
                  setFurnitureDraft((previous) => ({
                    ...previous,
                    widthFt: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
            <label>
              Depth (ft)
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={furnitureDraft.depthFt}
                onChange={(event) =>
                  setFurnitureDraft((previous) => ({
                    ...previous,
                    depthFt: Number(event.target.value),
                  }))
                }
                required
              />
            </label>
          </div>
          <button type="submit" disabled={!stageMetrics}>
            Add to Floor Plan
          </button>
        </form>

        <div className="panel-block">
          <h2>4. Rotate Selected Furniture</h2>
          <p className="hint">
            Click a furniture item on the plan, then rotate it with these controls.
          </p>
          <label>
            Rotation ({selectedFurniture?.rotation ?? 0}°)
            <input
              type="range"
              min="0"
              max="359"
              value={selectedFurniture?.rotation ?? 0}
              disabled={!selectedFurniture}
              onChange={(event) => updateSelectedRotation(Number(event.target.value))}
            />
          </label>
          <div className="rotation-buttons">
            <button
              type="button"
              onClick={() => updateSelectedRotation((selectedFurniture?.rotation ?? 0) - 15)}
              disabled={!selectedFurniture}
            >
              Rotate -15°
            </button>
            <button
              type="button"
              onClick={() => updateSelectedRotation((selectedFurniture?.rotation ?? 0) + 15)}
              disabled={!selectedFurniture}
            >
              Rotate +15°
            </button>
          </div>
          <button
            type="button"
            onClick={rotateSelectedByNinety}
            disabled={!selectedFurniture}
          >
            Rotate +90°
          </button>
          <button
            type="button"
            className="danger"
            onClick={removeSelectedFurniture}
            disabled={!selectedFurniture}
          >
            Remove Selected Furniture
          </button>
        </div>
      </section>

      <section className="stage-wrap">
        {!stageMetrics || !floorPlan ? (
          <div className="empty-state">Upload a floor plan to start arranging furniture.</div>
        ) : (
          <div
            className="stage"
            style={{
              width: `${stageMetrics.renderWidth}px`,
              height: `${stageMetrics.renderHeight}px`,
            }}
          >
            <img
              className="floor-plan-image"
              src={floorPlan.url}
              alt="Uploaded floor plan"
              draggable="false"
            />

            {roomGrids.map((grid) => {
              const widthPx = grid.widthFt * stageMetrics.pxPerFtX
              const heightPx = grid.heightFt * stageMetrics.pxPerFtY

              return (
                <button
                  key={grid.id}
                  type="button"
                  className={`room-grid ${selectedRoomGridId === grid.id ? 'selected' : ''}`}
                  onMouseDown={(event) => startDraggingRoomGrid(event, grid)}
                  onClick={() => setSelectedRoomGridId(grid.id)}
                  style={{
                    left: `${grid.x}px`,
                    top: `${grid.y}px`,
                    width: `${widthPx}px`,
                    height: `${heightPx}px`,
                    '--cell-x': `${stageMetrics.pxPerFtX}px`,
                    '--cell-y': `${stageMetrics.pxPerFtY}px`,
                    '--grid-hue': `${grid.colorHue}`,
                  }}
                >
                  <span className="room-grid-label">
                    {grid.name} ({grid.widthFt} x {grid.heightFt} ft)
                  </span>
                </button>
              )
            })}

            {furnitureItems.map((item) => {
              const widthPx = item.widthFt * stageMetrics.pxPerFtX
              const depthPx = item.depthFt * stageMetrics.pxPerFtY

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`furniture-item ${selectedFurnitureId === item.id ? 'selected' : ''}`}
                  onMouseDown={(event) => startDraggingFurniture(event, item)}
                  onClick={() => setSelectedFurnitureId(item.id)}
                  style={{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: `${widthPx}px`,
                    height: `${depthPx}px`,
                    transform: `rotate(${item.rotation}deg)`,
                  }}
                >
                  <img src={item.imageUrl} alt={item.name} draggable="false" />
                  <span>{item.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
