"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Folder,
  ChevronRight,
  Box,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TreeViewItem {
  id: string;
  name: string;
  type: string;
  children?: TreeViewItem[];
  checked?: boolean;
}

export interface TreeViewIconMap {
  [key: string]: React.ReactNode | undefined;
}

export interface TreeViewMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: (items: TreeViewItem[]) => void;
  showFor?: (item: TreeViewItem) => boolean;
  separator?: boolean;
}

export interface TreeViewProps {
  className?: string;
  data: TreeViewItem[];
  title?: string;
  showCheckboxes?: boolean;
  checkboxPosition?: "left" | "right";
  getIcon?: (item: TreeViewItem, depth: number) => React.ReactNode;
  onSelectionChange?: (selectedItems: TreeViewItem[]) => void;
  onAction?: (action: string, items: TreeViewItem[]) => void;
  onCheckChange?: (item: TreeViewItem, checked: boolean) => void;
  onDrop?: (draggedItem: TreeViewItem, targetItem: TreeViewItem) => void;
  iconMap?: TreeViewIconMap;
  menuItems?: TreeViewMenuItem[];
  editingId?: string | null;
  onEditCommit?: (id: string, newName: string) => void;
  onEditCancel?: (id: string) => void;
  dropTargetId?: string | null;
}

interface TreeItemProps {
  item: TreeViewItem;
  depth?: number;
  selectedIds: Set<string>;
  lastSelectedId: React.MutableRefObject<string | null>;
  onSelect: (ids: Set<string>) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string, isOpen: boolean) => void;
  getIcon?: (item: TreeViewItem, depth: number) => React.ReactNode;
  onAction?: (action: string, items: TreeViewItem[]) => void;
  onAccessChange?: (item: TreeViewItem, hasAccess: boolean) => void;
  allItems: TreeViewItem[];
  showAccessRights?: boolean;
  itemMap: Map<string, TreeViewItem>;
  iconMap?: TreeViewIconMap;
  menuItems?: TreeViewMenuItem[];
  getSelectedItems: () => TreeViewItem[];
  onDrop?: (draggedItem: TreeViewItem, targetItem: TreeViewItem) => void;
  editingId?: string | null;
  onEditCommit?: (id: string, newName: string) => void;
  onEditCancel?: (id: string) => void;
  dropTargetId?: string | null;
}

// Helper function to build a map of all items by ID
const buildItemMap = (items: TreeViewItem[]): Map<string, TreeViewItem> => {
  const map = new Map<string, TreeViewItem>();
  const processItem = (item: TreeViewItem) => {
    map.set(item.id, item);
    item.children?.forEach(processItem);
  };
  items.forEach(processItem);
  return map;
};

// Update the getCheckState function to work bottom-up
const getCheckState = (
  item: TreeViewItem,
  itemMap: Map<string, TreeViewItem>
): "checked" | "unchecked" | "indeterminate" => {
  // Get the original item from the map
  const originalItem = itemMap.get(item.id);
  if (!originalItem) return "unchecked";

  // If it's a leaf node (no children), return its check state
  if (!originalItem.children || originalItem.children.length === 0) {
    return originalItem.checked ? "checked" : "unchecked";
  }

  // Count the check states of immediate children
  let checkedCount = 0;
  let indeterminateCount = 0;

  originalItem.children.forEach(child => {
    const childState = getCheckState(child, itemMap);
    if (childState === "checked") checkedCount++;
    if (childState === "indeterminate") indeterminateCount++;
  });

  // Calculate parent state based on children states
  const totalChildren = originalItem.children.length;

  // If all children are checked
  if (checkedCount === totalChildren) {
    return "checked";
  }
  // If any child is checked or indeterminate
  if (checkedCount > 0 || indeterminateCount > 0) {
    return "indeterminate";
  }
  // If no children are checked or indeterminate
  return "unchecked";
};

// Add this default icon map
const defaultIconMap: TreeViewIconMap = {
  file: <Box className="h-4 w-4 text-red-600" />,
  folder: <Folder className="h-4 w-4 text-primary/80" />,
};

function TreeItem({
  item,
  depth = 0,
  selectedIds,
  lastSelectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  getIcon,
  onAction,
  onAccessChange,
  allItems,
  showAccessRights,
  itemMap,
  iconMap = defaultIconMap,
  menuItems,
  getSelectedItems,
  onDrop,
  editingId,
  onEditCommit,
  onEditCancel,
  dropTargetId,
}: TreeItemProps): React.ReactElement {
  const isOpen = expandedIds.has(item.id);
  const isSelected = selectedIds.has(item.id);
  const itemRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectionStyle, setSelectionStyle] = useState("");

  // Get all visible items in order
  const getVisibleItems = useCallback(
    (items: TreeViewItem[]): TreeViewItem[] => {
      let visibleItems: TreeViewItem[] = [];

      items.forEach((item) => {
        visibleItems.push(item);
        if (item.children && expandedIds.has(item.id)) {
          visibleItems = [...visibleItems, ...getVisibleItems(item.children)];
        }
      });

      return visibleItems;
    },
    [expandedIds]
  );

  useEffect(() => {
    if (!isSelected) {
      setSelectionStyle("");
      return;
    }

    // Get all visible items from the entire tree
    const visibleItems = getVisibleItems(allItems);
    const currentIndex = visibleItems.findIndex((i) => i.id === item.id);

    const prevItem = visibleItems[currentIndex - 1];
    const nextItem = visibleItems[currentIndex + 1];

    const isPrevSelected = prevItem && selectedIds.has(prevItem.id);
    const isNextSelected = nextItem && selectedIds.has(nextItem.id);

    const roundTop = !isPrevSelected;
    const roundBottom = !isNextSelected;

    setSelectionStyle(
      `${roundTop ? "rounded-t-md" : ""} ${roundBottom ? "rounded-b-md" : ""}`
    );
  }, [
    isSelected,
    selectedIds,
    expandedIds,
    item.id,
    getVisibleItems,
    allItems,
  ]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let newSelection = new Set(selectedIds);

    if (!itemRef.current) return;

    if (e.shiftKey && lastSelectedId.current !== null) {
      const items = Array.from(
        document.querySelectorAll("[data-tree-item]")
      ) as HTMLElement[];
      const lastIndex = items.findIndex(
        (el) => el.getAttribute("data-id") === lastSelectedId.current
      );
      const currentIndex = items.findIndex((el) => el === itemRef.current);
      const [start, end] = [
        Math.min(lastIndex, currentIndex),
        Math.max(lastIndex, currentIndex),
      ];

      items.slice(start, end + 1).forEach((el) => {
        const id = el.getAttribute("data-id");
        const parentFolderClosed = el.closest('[data-folder-closed="true"]');
        const isClosedFolder = el.getAttribute("data-folder-closed") === "true";

        if (id && (isClosedFolder || !parentFolderClosed)) {
          newSelection.add(id);
        }
      });
    } else if (e.ctrlKey || e.metaKey) {
      if (newSelection.has(item.id)) {
        newSelection.delete(item.id);
      } else {
        newSelection.add(item.id);
      }
    } else {
      newSelection = new Set([item.id]);
      // Open folder on single click if it's a folder
      if (item.children && isSelected) {
        onToggleExpand(item.id, !isOpen);
      }
    }

    lastSelectedId.current = item.id;
    onSelect(newSelection);
  };

  const handleAction = (action: string) => {
    if (onAction) {
      // Get all selected items, or just this item if none selected
      const selectedItems =
        selectedIds.size > 0
          ? allItems
              .flatMap((item) => getAllDescendants(item))
              .filter((item) => selectedIds.has(item.id))
          : [item];
      onAction(action, selectedItems);
    }
  };

  // Helper function to get all descendants of an item (including the item itself)
  const getAllDescendants = (item: TreeViewItem): TreeViewItem[] => {
    const descendants = [item];
    if (item.children) {
      item.children.forEach((child) => {
        descendants.push(...getAllDescendants(child));
      });
    }
    return descendants;
  };

  const handleAccessClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAccessChange) {
      const currentState = getCheckState(item, itemMap);
      // Toggle between checked and unchecked, treating indeterminate as unchecked
      const newChecked = currentState === "checked" ? false : true;
      onAccessChange(item, newChecked);
    }
  };

  const renderIcon = () => {
    if (getIcon) {
      return getIcon(item, depth);
    }

    // Use the provided iconMap or fall back to default
    return iconMap[item.type] || iconMap.folder || defaultIconMap.folder;
  };

  const isEditing = editingId === item.id;

  const renderNameOrInput = () => {
    if (!isEditing) {
      return (
        <span className="min-w-0 flex-1 truncate" title={item.name}>
          {item.name}
        </span>
      );
    }
    return (
      <input
        autoFocus
        defaultValue={item.name}
        className="min-w-0 flex-1 h-5 px-1 text-sm border border-blue-500 rounded outline-none bg-white"
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => {
          // Select filename without extension for files, select all for folders
          const val = e.target.value;
          const dotIndex = val.lastIndexOf(".");
          if (dotIndex > 0 && item.type !== "folder") {
            e.target.setSelectionRange(0, dotIndex);
          } else {
            e.target.select();
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            const val = (e.target as HTMLInputElement).value.trim();
            if (val && onEditCommit) onEditCommit(item.id, val);
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (onEditCancel) onEditCancel(item.id);
          }
        }}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val && onEditCommit) onEditCommit(item.id, val);
          else if (onEditCancel) onEditCancel(item.id);
        }}
      />
    );
  };

  const getItemPath = (item: TreeViewItem, items: TreeViewItem[]): string => {
    const path: string[] = [item.name];

    const findParent = (
      currentItem: TreeViewItem,
      allItems: TreeViewItem[]
    ) => {
      for (const potentialParent of allItems) {
        if (
          potentialParent.children?.some((child) => child.id === currentItem.id)
        ) {
          path.unshift(potentialParent.name);
          findParent(potentialParent, allItems);
          break;
        }
        if (potentialParent.children) {
          findParent(currentItem, potentialParent.children);
        }
      }
    };

    findParent(item, items);
    return path.join(" → ");
  };

  // Add function to count selected items in a folder
  const getSelectedChildrenCount = (item: TreeViewItem): number => {
    let count = 0;

    if (!item.children) return 0;

    item.children.forEach((child) => {
      if (selectedIds.has(child.id)) {
        count++;
      }
      if (child.children) {
        count += getSelectedChildrenCount(child);
      }
    });

    return count;
  };

  // Get selected count only if item has children and is collapsed
  const selectedCount =
    (item.children && !isOpen && getSelectedChildrenCount(item)) || null;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="min-w-0 max-w-full">
          <div
            ref={itemRef}
            data-tree-item
            data-id={item.id}
            data-depth={depth}
            data-folder-closed={item.children && !isOpen}
            className={`min-w-0 max-w-full select-none cursor-pointer ${
              isSelected ? `bg-orange-100 ${selectionStyle}` : "text-foreground"
            } ${dragOver ? "bg-blue-100 ring-1 ring-blue-400 rounded" : ""} ${
              dropTargetId === item.id ? "bg-blue-50 ring-2 ring-blue-400 ring-inset rounded" : ""
            } px-1`}
            style={{ paddingLeft: `${depth * 20}px` }}
            onClick={handleClick}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", item.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const draggedId = e.dataTransfer.getData("text/plain");
              if (draggedId && draggedId !== item.id && onDrop) {
                const draggedItem = itemMap.get(draggedId);
                if (draggedItem) onDrop(draggedItem, item);
              }
            }}
          >
            <div className="flex h-8 min-w-0 items-center">
              {item.children ? (
                <div className="group flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  <Collapsible
                    open={isOpen}
                    onOpenChange={(open) => onToggleExpand(item.id, open)}
                  >
                    <CollapsibleTrigger onClick={(e) => e.stopPropagation()} render={<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" />}><motion.div
                                                                initial={false}
                                                                animate={{ rotate: isOpen ? 90 : 0 }}
                                                                transition={{ duration: 0.1 }}
                                                              >
                                                                <ChevronRight className="h-4 w-4" />
                                                              </motion.div></CollapsibleTrigger>
                  </Collapsible>
                  {showAccessRights && (
                    <div
                      className="relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center hover:opacity-80"
                      onClick={handleAccessClick}
                    >
                      {getCheckState(item, itemMap) === "checked" && (
                        <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-primary-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                      {getCheckState(item, itemMap) === "unchecked" && (
                        <div className="w-4 h-4 border rounded border-input" />
                      )}
                      {getCheckState(item, itemMap) === "indeterminate" && (
                        <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                          <div className="h-0.5 w-2 bg-primary-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                  <span className="inline-flex shrink-0 items-center [&>*]:shrink-0">
                    {renderIcon()}
                  </span>
                  {renderNameOrInput()}
                  {selectedCount !== null && selectedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="mr-2 shrink-0 bg-blue-100 hover:bg-blue-100"
                    >
                      {selectedCount} selected
                    </Badge>
                  )}
                  <HoverCard>
                    <HoverCardTrigger render={<Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0 group-hover:opacity-100 opacity-0 items-center justify-center" onClick={(e) => e.stopPropagation()} />}><Info className="h-4 w-4 text-muted-foreground" /></HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{item.name}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Type:</span>{" "}
                            {item.type.charAt(0).toUpperCase() +
                              item.type.slice(1).replace("_", " ")}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span> {item.id}
                          </div>
                          <div>
                            <span className="font-medium">Location:</span>{" "}
                            {getItemPath(item, allItems)}
                          </div>
                          <div>
                            <span className="font-medium">Items:</span>{" "}
                            {item.children?.length || 0} direct items
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              ) : (
                <div className="group flex min-w-0 flex-1 items-center gap-2 overflow-hidden pl-8">
                  {showAccessRights && (
                    <div
                      className="relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center hover:opacity-80"
                      onClick={handleAccessClick}
                    >
                      {item.checked ? (
                        <div className="w-4 h-4 border rounded bg-primary border-primary flex items-center justify-center">
                          <svg
                            className="h-3 w-3 text-primary-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-4 h-4 border rounded border-input" />
                      )}
                    </div>
                  )}
                  <span className="inline-flex shrink-0 items-center [&>*]:shrink-0">
                    {renderIcon()}
                  </span>
                  {renderNameOrInput()}
                  {!isEditing && (
                  <HoverCard>
                    <HoverCardTrigger render={<Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0 group-hover:opacity-100 opacity-0 items-center justify-center" onClick={(e) => e.stopPropagation()} />}><Info className="h-4 w-4 text-muted-foreground" /></HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{item.name}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Type:</span>{" "}
                            {item.type.charAt(0).toUpperCase() +
                              item.type.slice(1).replace("_", " ")}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span> {item.id}
                          </div>
                          <div>
                            <span className="font-medium">Location:</span>{" "}
                            {getItemPath(item, allItems)}
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  )}
                </div>
              )}
            </div>
          </div>

          {item.children && (
            <Collapsible
              open={isOpen}
              onOpenChange={(open) => onToggleExpand(item.id, open)}
            >
              <CollapsibleContent>
                {item.children?.map((child) => (
                  <TreeItem
                    key={child.id}
                    item={child}
                    depth={depth + 1}
                    selectedIds={selectedIds}
                    lastSelectedId={lastSelectedId}
                    onSelect={onSelect}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    getIcon={getIcon}
                    onAction={onAction}
                    onAccessChange={onAccessChange}
                    allItems={allItems}
                    showAccessRights={showAccessRights}
                    itemMap={itemMap}
                    iconMap={iconMap}
                    menuItems={menuItems}
                    getSelectedItems={getSelectedItems}
                    onDrop={onDrop}
                    editingId={editingId}
                    onEditCommit={onEditCommit}
                    onEditCancel={onEditCancel}
                    dropTargetId={dropTargetId}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {menuItems
          ?.filter((mi) => !mi.showFor || mi.showFor(item))
          .map((menuItem, idx) => (
            <React.Fragment key={menuItem.id}>
              {menuItem.separator && idx > 0 && <ContextMenuSeparator />}
              <ContextMenuItem
                onClick={() => {
                  const items = selectedIds.has(item.id)
                    ? getSelectedItems()
                    : [item];
                  menuItem.action(items);
                }}
              >
                {menuItem.icon && (
                  <span className="mr-2 h-4 w-4">{menuItem.icon}</span>
                )}
                {menuItem.label}
              </ContextMenuItem>
            </React.Fragment>
          ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function TreeView({
  className,
  data,
  iconMap,
  showCheckboxes = false,
  getIcon,
  onSelectionChange,
  onAction,
  onCheckChange,
  onDrop,
  menuItems,
  editingId,
  onEditCommit,
  onEditCancel,
  dropTargetId,
}: TreeViewProps) {
  const [currentMousePos, setCurrentMousePos] = useState<number>(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Start with all folders expanded
    const collectFolderIds = (items: TreeViewItem[]): string[] => {
      const ids: string[] = [];
      for (const item of items) {
        if (item.children) {
          ids.push(item.id);
          ids.push(...collectFolderIds(item.children));
        }
      }
      return ids;
    };
    return new Set(collectFolderIds(data));
  });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const dragRef = useRef<HTMLDivElement>(null);
  const lastSelectedId = useRef<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const DRAG_THRESHOLD = 10; // pixels

  // Expand any new folders when data changes
  useEffect(() => {
    const collectFolderIds = (items: TreeViewItem[]): string[] => {
      const ids: string[] = [];
      for (const item of items) {
        if (item.children) {
          ids.push(item.id);
          ids.push(...collectFolderIds(item.children));
        }
      }
      return ids;
    };
    const allFolderIds = collectFolderIds(data);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of allFolderIds) {
        next.add(id);
      }
      return next;
    });
  }, [data]);

  // Create a map of all items by ID
  const itemMap = useMemo(() => buildItemMap(data), [data]);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      const target = e.target as Element;

      const clickedInside =
        (treeRef.current && treeRef.current.contains(target)) ||
        (dragRef.current && dragRef.current.contains(target)) ||
        // Ignore clicks on context menus
        target.closest('[role="menu"]') ||
        target.closest("[data-radix-popper-content-wrapper]");

      if (!clickedInside) {
        setSelectedIds(new Set());
        lastSelectedId.current = null;
      }
    };

    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  const handleToggleExpand = (id: string, isOpen: boolean) => {
    const newExpandedIds = new Set(expandedIds);
    if (isOpen) {
      newExpandedIds.add(id);
    } else {
      newExpandedIds.delete(id);
    }
    setExpandedIds(newExpandedIds);
  };

  // Get selected items
  const getSelectedItems = useCallback((): TreeViewItem[] => {
    const items: TreeViewItem[] = [];
    const processItem = (item: TreeViewItem) => {
      if (selectedIds.has(item.id)) {
        items.push(item);
      }
      item.children?.forEach(processItem);
    };
    data.forEach(processItem);
    return items;
  }, [selectedIds, data]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only track on left click and not on buttons
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;

    setDragStartPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Check if primary button is still held down
      if (!(e.buttons & 1)) {
        setIsDragging(false);
        setDragStart(null);
        setDragStartPosition(null);
        return;
      }

      // If we haven't registered a potential drag start position, ignore
      if (!dragStartPosition) return;

      // Calculate distance moved
      const deltaX = e.clientX - dragStartPosition.x;
      const deltaY = e.clientY - dragStartPosition.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // If we haven't started dragging yet, check if we should start
      if (!isDragging) {
        if (distance > DRAG_THRESHOLD) {
          setIsDragging(true);
          setDragStart(dragStartPosition.y);

          // Clear selection if not holding shift/ctrl
          if (!e.shiftKey && !e.ctrlKey) {
            setSelectedIds(new Set());
            lastSelectedId.current = null;
          }
        }
        return;
      }

      // Rest of the existing drag logic
      if (!dragRef.current) return;

      const items = Array.from(
        dragRef.current.querySelectorAll("[data-tree-item]")
      ) as HTMLElement[];

      const startY = dragStart;
      const currentY = e.clientY;
      const [selectionStart, selectionEnd] = [
        Math.min(startY || 0, currentY),
        Math.max(startY || 0, currentY),
      ];

      const newSelection = new Set(
        e.shiftKey || e.ctrlKey ? Array.from(selectedIds) : []
      );

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const itemTop = rect.top;
        const itemBottom = rect.top + rect.height;

        if (itemBottom >= selectionStart && itemTop <= selectionEnd) {
          const id = item.getAttribute("data-id");
          const isClosedFolder =
            item.getAttribute("data-folder-closed") === "true";
          const parentFolderClosed = item.closest(
            '[data-folder-closed="true"]'
          );

          if (id && (isClosedFolder || !parentFolderClosed)) {
            newSelection.add(id);
          }
        }
      });

      setSelectedIds(newSelection);
      setCurrentMousePos(e.clientY);
    },
    [isDragging, dragStart, selectedIds, dragStartPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setDragStartPosition(null);
  }, []);

  // Add cleanup for mouse events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("mouseleave", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [isDragging, handleMouseUp]);

  // Call onSelectionChange when selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(getSelectedItems());
    }
  }, [selectedIds, onSelectionChange, getSelectedItems]);

  return (
    <div className="flex min-w-0 gap-4">
      <div
        ref={treeRef}
        className="relative w-full min-w-0 max-w-full bg-transparent p-2"
      >
        <div
          ref={dragRef}
          className={cn(
            "relative min-w-0 max-w-full select-none rounded-lg bg-card",
            className
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          {isDragging && (
            <div
              className="absolute inset-0 bg-blue-500/0 pointer-events-none"
              style={{
                top: Math.min(
                  dragStart || 0,
                  dragStart === null ? 0 : currentMousePos
                ),
                height: Math.abs(
                  (dragStart || 0) - (dragStart === null ? 0 : currentMousePos)
                ),
              }}
            />
          )}
          {data.map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              selectedIds={selectedIds}
              lastSelectedId={lastSelectedId}
              onSelect={setSelectedIds}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
              getIcon={getIcon}
              onAction={onAction}
              onAccessChange={onCheckChange}
              allItems={data}
              showAccessRights={showCheckboxes}
              itemMap={itemMap}
              iconMap={iconMap}
              menuItems={menuItems}
              getSelectedItems={getSelectedItems}
              onDrop={onDrop}
              editingId={editingId}
              onEditCommit={onEditCommit}
              onEditCancel={onEditCancel}
              dropTargetId={dropTargetId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
