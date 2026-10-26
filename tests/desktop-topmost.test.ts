import { test, expect, vi } from "vitest";
import { raiseDesktopWindows } from "../src/main/desktop-topmost";
test("restores ordered topmost surfaces without showing hidden windows or taking focus", () => {
  const order: number[] = [];
  const window = (id:number, visible=true, destroyed=false) => ({isDestroyed:()=>destroyed,isVisible:()=>visible,isMinimized:()=>false,setAlwaysOnTop:vi.fn(),moveTop:vi.fn(()=>order.push(id)),show:vi.fn(),focus:vi.fn()});
  const pet=window(1), hidden=window(2,false), bubble=window(3), dead=window(4,true,true);
  raiseDesktopWindows([pet,hidden,bubble,dead] as any,true);
  expect(order).toEqual([1,3]);
  expect(pet.setAlwaysOnTop).toHaveBeenCalledWith(true,"screen-saver");
  expect(hidden.moveTop).not.toHaveBeenCalled();expect(dead.setAlwaysOnTop).not.toHaveBeenCalled();
  expect(pet.focus).not.toHaveBeenCalled();expect(hidden.show).not.toHaveBeenCalled();
  raiseDesktopWindows([pet,bubble] as any,false);
  expect(order).toEqual([1,3]);expect(bubble.setAlwaysOnTop).toHaveBeenLastCalledWith(false,"screen-saver");
});
