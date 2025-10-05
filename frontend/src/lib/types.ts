export interface FloorplanObject {
	id: string;
	type: string;
	name: string;
	model: number; // Model variation index (0-based)
	position: {
		x: number;
		y: number;
	};
	dimensions: {
		width: number;
		height: number;
	};
	rotation: number; // Rotation in degrees (0-360)
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
	confidence?: string;
	reasoning?: string;
	aspect_ratio?: {
		value: number;
		typical: string;
		description: string;
	};
	[key: string]: any;
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
