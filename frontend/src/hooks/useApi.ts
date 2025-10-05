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

	return useMutation({
		mutationFn: async (floorplanFile: File) => {
			return await api.floorplan.extract(floorplanFile);
		},
		onSuccess: (data) => {
			setFloorplanObjects(data.objects);
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
