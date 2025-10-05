export interface FloorplanObject {
	id: string;
	type: string;
	name: string;
	position: {
		x: number;
		y: number;
	};
	dimensions: {
		width: number;
		height: number;
	};
	bbox_normalized: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	};
	bbox_pixels?: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	};
	confidence: string;
	reasoning?: string;
	aspect_ratio?: {
		value: number;
		typical: string;
		description: string;
	};
	[key: string]: any;
}

export interface BoundaryObject {
	id: string;
	class: string; // "wall", "window", "door"
	position: {
		x: number;
		y: number;
	};
	dimensions: {
		width: number;
		height: number;
	};
	confidence: number;
	bbox_normalized: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	};
	bbox_pixels: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	};
}

export interface UnityScene {
	objects: any[];
	[key: string]: any;
}

export interface Annotation {
	id: string;
	x: number;
	y: number;
	text: string;
}
