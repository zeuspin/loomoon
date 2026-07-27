export type Point = { x: number; y: number };
export type GesturePoint = Point & { id: number };
export type CameraTransform = { position: Point; scale: number };

export type CameraFrameBatcher = {
  cancel: () => void;
  update: (camera: CameraTransform) => void;
};

export function createCameraFrameBatcher(input: {
  cancelFrame?: (frameId: number) => void;
  commit: (camera: CameraTransform) => void;
  present: (camera: CameraTransform) => void;
  requestFrame: (callback: () => void) => number;
}): CameraFrameBatcher {
  let frameId: number | undefined;
  let pendingCamera: CameraTransform | undefined;
  return {
    cancel: () => {
      if (frameId !== undefined) input.cancelFrame?.(frameId);
      frameId = undefined;
      pendingCamera = undefined;
    },
    update: (camera) => {
      pendingCamera = camera;
      input.present(camera);
      if (frameId !== undefined) return;
      frameId = input.requestFrame(() => {
        frameId = undefined;
        const latestCamera = pendingCamera;
        pendingCamera = undefined;
        if (latestCamera) input.commit(latestCamera);
      });
    },
  };
}

export type TwoPointerNavigation = {
  anchoredCanvasPoint: Point;
  pointerIds: [number, number];
  startCamera: CameraTransform;
  startCenter: Point;
  startDistance: number;
};

export type CanvasTouchGesture =
  | { kind: "idle" }
  | { kind: "single-pointer"; point: GesturePoint }
  | {
      extraPointerIds: number[];
      kind: "two-pointer-navigation";
      navigation: TwoPointerNavigation;
      points: [GesturePoint, GesturePoint];
    }
  | { kind: "awaiting-all-pointers-up"; pointerIds: number[] };

export type CanvasTouchEffect =
  | { kind: "none" }
  | { kind: "begin-single"; point: GesturePoint }
  | { kind: "move-single"; point: GesturePoint }
  | { kind: "finish-single"; pointerId: number }
  | { kind: "cancel-single"; pointerId: number }
  | { kind: "navigate"; camera: CameraTransform };

type CanvasTouchResult = { effect: CanvasTouchEffect; gesture: CanvasTouchGesture };

const noTouchEffect = { kind: "none" } as const;

export function idleCanvasTouchGesture(): CanvasTouchGesture {
  return { kind: "idle" };
}

function midpoint(points: readonly [GesturePoint, GesturePoint]): Point {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function distance(points: readonly [GesturePoint, GesturePoint]): number {
  return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function orderGesturePoints(
  points: readonly [GesturePoint, GesturePoint],
  pointerIds?: readonly [number, number],
): [GesturePoint, GesturePoint] {
  if (!pointerIds) return points[0].id <= points[1].id ? [points[0], points[1]] : [points[1], points[0]];
  const first = points.find((point) => point.id === pointerIds[0]);
  const second = points.find((point) => point.id === pointerIds[1]);
  return first && second ? [first, second] : [points[0], points[1]];
}

export function beginTwoPointerNavigation(
  inputPoints: readonly [GesturePoint, GesturePoint],
  camera: CameraTransform,
): TwoPointerNavigation {
  const points = orderGesturePoints(inputPoints);
  const startCenter = midpoint(points);
  return {
    anchoredCanvasPoint: {
      x: (startCenter.x - camera.position.x) / camera.scale,
      y: (startCenter.y - camera.position.y) / camera.scale,
    },
    pointerIds: [points[0].id, points[1].id],
    startCamera: camera,
    startCenter,
    startDistance: distance(points),
  };
}

export function updateTwoPointerNavigation(
  gesture: TwoPointerNavigation,
  inputPoints: readonly [GesturePoint, GesturePoint],
  bounds: { minScale: number; maxScale: number },
): CameraTransform {
  const points = orderGesturePoints(inputPoints, gesture.pointerIds);
  const center = midpoint(points);
  if (gesture.startDistance < 1) {
    return {
      position: {
        x: gesture.startCamera.position.x + center.x - gesture.startCenter.x,
        y: gesture.startCamera.position.y + center.y - gesture.startCenter.y,
      },
      scale: gesture.startCamera.scale,
    };
  }
  const scale = clamp(
    gesture.startCamera.scale * distance(points) / gesture.startDistance,
    bounds.minScale,
    bounds.maxScale,
  );
  return {
    position: {
      x: center.x - gesture.anchoredCanvasPoint.x * scale,
      y: center.y - gesture.anchoredCanvasPoint.y * scale,
    },
    scale,
  };
}

export function beginCanvasTouch(
  gesture: CanvasTouchGesture,
  point: GesturePoint,
  camera: CameraTransform,
): CanvasTouchResult {
  if (gesture.kind === "idle") {
    return {
      effect: { kind: "begin-single", point },
      gesture: { kind: "single-pointer", point },
    };
  }
  if (gesture.kind === "single-pointer") {
    const points: [GesturePoint, GesturePoint] = [gesture.point, point];
    return {
      effect: { kind: "finish-single", pointerId: gesture.point.id },
      gesture: {
        extraPointerIds: [],
        kind: "two-pointer-navigation",
        navigation: beginTwoPointerNavigation(points, camera),
        points,
      },
    };
  }
  if (gesture.kind === "two-pointer-navigation") {
    return {
      effect: noTouchEffect,
      gesture: {
        ...gesture,
        extraPointerIds: gesture.extraPointerIds.includes(point.id)
          ? gesture.extraPointerIds
          : [...gesture.extraPointerIds, point.id],
      },
    };
  }
  return {
    effect: noTouchEffect,
    gesture: {
      ...gesture,
      pointerIds: gesture.pointerIds.includes(point.id)
        ? gesture.pointerIds
        : [...gesture.pointerIds, point.id],
    },
  };
}

export function moveCanvasTouch(
  gesture: CanvasTouchGesture,
  point: GesturePoint,
  bounds: { minScale: number; maxScale: number },
): CanvasTouchResult {
  if (gesture.kind === "single-pointer" && gesture.point.id === point.id) {
    return {
      effect: { kind: "move-single", point },
      gesture: { kind: "single-pointer", point },
    };
  }
  if (gesture.kind === "two-pointer-navigation") {
    const pointIndex = gesture.points.findIndex((item) => item.id === point.id);
    if (pointIndex < 0) return { effect: noTouchEffect, gesture };
    const points: [GesturePoint, GesturePoint] = [...gesture.points];
    points[pointIndex] = point;
    return {
      effect: {
        camera: updateTwoPointerNavigation(gesture.navigation, points, bounds),
        kind: "navigate",
      },
      gesture: { ...gesture, points },
    };
  }
  return { effect: noTouchEffect, gesture };
}

export function endCanvasTouch(
  gesture: CanvasTouchGesture,
  pointerId: number,
): CanvasTouchResult {
  if (gesture.kind === "single-pointer" && gesture.point.id === pointerId) {
    return {
      effect: { kind: "finish-single", pointerId },
      gesture: idleCanvasTouchGesture(),
    };
  }
  if (gesture.kind === "two-pointer-navigation") {
    const pointerIds = [
      ...gesture.points.map((point) => point.id),
      ...gesture.extraPointerIds,
    ].filter((id) => id !== pointerId);
    return {
      effect: noTouchEffect,
      gesture: pointerIds.length === 0
        ? idleCanvasTouchGesture()
        : { kind: "awaiting-all-pointers-up", pointerIds },
    };
  }
  if (gesture.kind === "awaiting-all-pointers-up") {
    const pointerIds = gesture.pointerIds.filter((id) => id !== pointerId);
    return {
      effect: noTouchEffect,
      gesture: pointerIds.length === 0
        ? idleCanvasTouchGesture()
        : { ...gesture, pointerIds },
    };
  }
  return { effect: noTouchEffect, gesture };
}

export function cancelCanvasTouch(gesture: CanvasTouchGesture): CanvasTouchResult {
  return {
    effect: gesture.kind === "single-pointer"
      ? { kind: "cancel-single", pointerId: gesture.point.id }
      : noTouchEffect,
    gesture: idleCanvasTouchGesture(),
  };
}

type WheelCameraInput = {
  camera: CameraTransform;
  ctrlKey: boolean;
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  maxScale: number;
  metaKey: boolean;
  minScale: number;
  pointer: Point;
  viewportHeight: number;
};

function wheelPixels(delta: number, deltaMode: number, viewportHeight: number): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * viewportHeight;
  return delta;
}

export function wheelCameraChange(input: WheelCameraInput): CameraTransform {
  const deltaX = wheelPixels(input.deltaX, input.deltaMode, input.viewportHeight);
  const deltaY = wheelPixels(input.deltaY, input.deltaMode, input.viewportHeight);
  if (!input.ctrlKey && !input.metaKey) {
    return {
      position: {
        x: input.camera.position.x - deltaX,
        y: input.camera.position.y - deltaY,
      },
      scale: input.camera.scale,
    };
  }

  const limitedDelta = clamp(deltaY, -240, 240);
  const scale = clamp(
    input.camera.scale * Math.exp(-limitedDelta * 0.002),
    input.minScale,
    input.maxScale,
  );
  const anchoredCanvasPoint = {
    x: (input.pointer.x - input.camera.position.x) / input.camera.scale,
    y: (input.pointer.y - input.camera.position.y) / input.camera.scale,
  };
  return {
    position: {
      x: input.pointer.x - anchoredCanvasPoint.x * scale,
      y: input.pointer.y - anchoredCanvasPoint.y * scale,
    },
    scale,
  };
}
