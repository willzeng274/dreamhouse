import { create } from "zustand";
import { FloorplanObject } from "@/lib/types";

interface AppState {
	// Sketch data
	sketchDataUrl: string | null;
	setSketchDataUrl: (dataUrl: string | null) => void;

	// Floorplan data
	floorplanBlob: Blob | null;
	floorplanDataUrl: string | null;
	setFloorplanBlob: (blob: Blob | null) => void;
	setFloorplanDataUrl: (dataUrl: string | null) => void;

	// Extracted objects from floorplan
	floorplanObjects: FloorplanObject[];
	setFloorplanObjects: (objects: FloorplanObject[]) => void;

	// Photorealistic render
	renderBlob: Blob | null;
	renderDataUrl: string | null;
	setRenderBlob: (blob: Blob | null) => void;
	setRenderDataUrl: (dataUrl: string | null) => void;

	// Unity scene
	unityScene: any | null;
	setUnityScene: (scene: any) => void;

	// Helper to convert blob to data URL
	blobToDataUrl: (blob: Blob) => Promise<string>;

	// Reset all state
	reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
	// Initial state
	sketchDataUrl: null,
	floorplanBlob: null,
	floorplanDataUrl: null,
	floorplanObjects: [],
	renderBlob: null,
	renderDataUrl: null,
	unityScene: null,

	// Setters
	setSketchDataUrl: (dataUrl) => set({ sketchDataUrl: dataUrl }),

	setFloorplanBlob: (blob) => set({ floorplanBlob: blob }),
	setFloorplanDataUrl: (dataUrl) => set({ floorplanDataUrl: dataUrl }),

	setFloorplanObjects: (objects) => set({ floorplanObjects: objects }),

	setRenderBlob: (blob) => set({ renderBlob: blob }),
	setRenderDataUrl: (dataUrl) => set({ renderDataUrl: dataUrl }),

	setUnityScene: (scene) => set({ unityScene: scene }),

	// Helper function
	blobToDataUrl: async (blob: Blob): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	},

	// Reset
	reset: () =>
		set({
			sketchDataUrl: null,
			floorplanBlob: null,
			floorplanDataUrl: null,
			floorplanObjects: [],
			renderBlob: null,
			renderDataUrl: null,
			unityScene: null,
		}),
}));
