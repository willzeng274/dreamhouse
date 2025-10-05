import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export function useGenerateFloorplan() {
	const setFloorplanBlob = useAppStore((state) => state.setFloorplanBlob);
	const setFloorplanDataUrl = useAppStore(
		(state) => state.setFloorplanDataUrl
	);
	const blobToDataUrl = useAppStore((state) => state.blobToDataUrl);

	return useMutation({
		mutationFn: async (sketchFile: File) => {
			return await api.floorplan.generate(sketchFile);
		},
		onSuccess: async (blob) => {
			setFloorplanBlob(blob);
			const dataUrl = await blobToDataUrl(blob);
			setFloorplanDataUrl(dataUrl);
		},
	});
}

export function useExtractObjects() {
	const setFloorplanObjects = useAppStore(
		(state) => state.setFloorplanObjects
	);
	const setFloorplanBoundaries = useAppStore(
		(state) => state.setFloorplanBoundaries
	);

	return useMutation({
		mutationFn: async (floorplanFile: File) => {
			console.log("Starting extraction mutation...");
			const result = await api.floorplan.extract(floorplanFile);
			console.log(result);
			console.log("Extraction mutation completed");
			return result;
		},
		onSuccess: (data) => {
			console.log("✅ Extract objects SUCCESS - response:", data);
			console.log("Objects count:", data.objects?.length);
			console.log("Boundaries count:", data.boundaries?.length);

			if (!data || !data.objects) {
				console.error("❌ No objects in response:", data);
				throw new Error("No objects returned from API");
			}

			console.log("Setting objects in store...");
			setFloorplanObjects(data.objects);
			setFloorplanBoundaries(data.boundaries || []);
			console.log("✅ Successfully set objects and boundaries in store");
		},
		onError: (error) => {
			console.error("❌ Error extracting objects:", error);
		},
		onSettled: () => {
			console.log("Extraction mutation settled (completed or errored)");
		},
	});
}

export function useReviseFloorplan() {
	const setFloorplanBlob = useAppStore((state) => state.setFloorplanBlob);
	const setFloorplanDataUrl = useAppStore(
		(state) => state.setFloorplanDataUrl
	);
	const blobToDataUrl = useAppStore((state) => state.blobToDataUrl);

	return useMutation({
		mutationFn: async ({
			floorplanFile,
			instruction,
		}: {
			floorplanFile: File;
			instruction: string;
		}) => {
			return await api.floorplan.revise(floorplanFile, instruction);
		},
		onSuccess: async (blob) => {
			setFloorplanBlob(blob);
			const dataUrl = await blobToDataUrl(blob);
			setFloorplanDataUrl(dataUrl);
		},
	});
}

export function useGeneratePhotorealistic() {
	const setRenderBlob = useAppStore((state) => state.setRenderBlob);
	const setRenderDataUrl = useAppStore((state) => state.setRenderDataUrl);
	const blobToDataUrl = useAppStore((state) => state.blobToDataUrl);

	return useMutation({
		mutationFn: async (floorplanFile: File) => {
			return await api.image.generate(floorplanFile);
		},
		onSuccess: async (blob) => {
			setRenderBlob(blob);
			const dataUrl = await blobToDataUrl(blob);
			setRenderDataUrl(dataUrl);
		},
	});
}

export function useUpdateFloorPlan() {
	return useMutation({
		mutationFn: async (data: { objects: any[]; boundaries: any[] }) => {
			return await api.floorplan.updateFloorPlan(data);
		},
		onSuccess: (result) => {
			console.log("✅ Floor plan updated successfully:", result.message);
		},
		onError: (error) => {
			console.error("❌ Error updating floor plan:", error);
		},
	});
}

export function useExportScene() {
	const setUnityScene = useAppStore((state) => state.setUnityScene);

	return useMutation({
		mutationFn: async (objects: any[]) => {
			return await api.scene.export(objects);
		},
		onSuccess: (data) => {
			setUnityScene(data.unity_scene);
		},
	});
}
