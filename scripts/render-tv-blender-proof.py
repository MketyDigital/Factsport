#!/usr/bin/env python3
"""Render a short, original procedural 3D Factsport TV look-dev proof.

This is a fictional visual prototype, not a real fixture, stadium, team, player,
or match replay. It uses procedural geometry only and has no upload path.
Run: blender -b --python scripts/render-tv-blender-proof.py -- --output artifacts/factsport-tv-3d-proof.mp4
"""

import argparse
import math
import os
import subprocess
import tempfile

import bpy
from mathutils import Vector


def args_after_double_dash():
    raw = os.sys.argv
    tail = raw[raw.index("--") + 1:] if "--" in raw else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="artifacts/factsport-tv-3d-proof.mp4")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--seconds", type=float, default=7.5)
    parser.add_argument("--fps", type=int, default=24)
    return parser.parse_args(tail)


def material(name, color, metallic=0.0, roughness=0.7, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1.0)
        shader.inputs["Emission Strength"].default_value = emission
    return mat


def cube(name, location, scale, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def line(name, start, end, width, mat):
    direction = Vector(end) - Vector(start)
    obj = cube(name, (Vector(start) + Vector(end)) / 2, (width, width, direction.length), mat, width / 5)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def stadium(scene):
    grass_a = material("Pitch · deep grass", (0.035, 0.28, 0.13), roughness=0.9)
    grass_b = material("Pitch · light grass", (0.055, 0.39, 0.19), roughness=0.9)
    white = material("Markings · warm white", (0.88, 0.94, 0.89), roughness=0.45, emission=0.1)
    navy = material("Stands · midnight blue", (0.018, 0.055, 0.12), metallic=0.2)
    seat_a = material("Seats · ocean", (0.035, 0.30, 0.52), metallic=0.1)
    seat_b = material("Seats · cyan", (0.04, 0.65, 0.72), metallic=0.08)
    roof = material("Roof · titanium", (0.22, 0.30, 0.39), metallic=0.7, roughness=0.3)
    # Full-size stylized pitch with alternating mow stripes.
    cube("Stadium base", (0, 0, -1.8), (122, 164, 2.4), navy)
    cube("Pitch underlay", (0, 0, -0.48), (78, 112, 0.55), grass_a)
    for i in range(10):
        x = -35.1 + i * 7.8
        cube(f"Mowing stripe {i+1}", (x, 0, -0.17), (7.8, 110, 0.08), grass_b if i % 2 else grass_a)
    # Field markings: boundary, halves, center circle and penalty boxes.
    line("Touchline near", (-36, -52, -0.10), (36, -52, -0.10), 0.16, white)
    line("Touchline far", (-36, 52, -0.10), (36, 52, -0.10), 0.16, white)
    line("Goal line left", (-36, -52, -0.10), (-36, 52, -0.10), 0.16, white)
    line("Goal line right", (36, -52, -0.10), (36, 52, -0.10), 0.16, white)
    line("Halfway line", (-36, 0, -0.10), (36, 0, -0.10), 0.13, white)
    bpy.ops.mesh.primitive_torus_add(major_radius=9.15, minor_radius=0.12, major_segments=64, minor_segments=8, location=(0, 0, -0.09))
    bpy.context.object.name = "Center circle"
    bpy.context.object.data.materials.append(white)
    for sign in (-1, 1):
        y = sign * 41
        for x1, x2, y1, y2 in [(-20, 20, y - sign * 11, y + sign * 11), (-9, 9, y - sign * 4, y + sign * 4)]:
            line("Penalty-area marking", (x1, y1, -0.09), (x2, y1, -0.09), 0.12, white)
            line("Penalty-area marking", (x1, y1, -0.09), (x1, y2, -0.09), 0.12, white)
            line("Penalty-area marking", (x2, y1, -0.09), (x2, y2, -0.09), 0.12, white)

    # Stepped seating bowls on all four sides, with sparse cyan ribbons.
    for side in (-1, 1):
        for row in range(12):
            z = 2.1 + row * 1.15
            y = side * (60 + row * 1.5)
            cube(f"Long stand tier {side} {row}", (0, y, z), (108 + row * 2.3, 5.5, 1.0), navy, 0.2)
            cube(f"Seat color band {side} {row}", (0, y - side * 2.76, z + 0.36), (105 + row * 2.2, 0.22, 0.16), seat_b if row in (2, 8) else seat_a, 0.06)
        for row in range(10):
            z = 2.1 + row * 1.15
            x = side * (48 + row * 1.5)
            cube(f"End stand tier {side} {row}", (x, 0, z), (5.5, 116 + row * 2.3, 1.0), navy, 0.2)
            cube(f"End-seat color band {side} {row}", (x - side * 2.76, 0, z + 0.36), (0.22, 110 + row * 2.2, 0.16), seat_b if row in (2, 8) else seat_a, 0.06)

    # Roof trusses around the bowl and four floodlight masts.
    for side in (-1, 1):
        for x in (-47, 47):
            line("Roof support", (x, side * 60, 3), (x * 0.88, side * 68, 20), 1.2, roof)
        line("Roof fascia", (-54, side * 78, 20), (54, side * 78, 20), 1.1, roof)
        for x in (-48, -24, 0, 24, 48):
            cube("Floodlight bank", (x, side * 70, 18), (10, 0.6, 1.3), white, 0.2)
    for x in (-50, 50):
        for y in (-70, 70):
            cube("Floodlight mast", (x, y, 10), (0.45, 0.45, 20), roof, 0.1)
    # Goal frames and nets.
    goal = material("Goal frame", (0.88, 0.92, 0.91), metallic=0.5, roughness=0.35)
    for y in (-52, 52):
        direction = 1 if y < 0 else -1
        line("Goal crossbar", (-3.66, y, 2.45), (3.66, y, 2.45), 0.22, goal)
        for x in (-3.66, 3.66):
            line("Goal post", (x, y, 0), (x, y, 2.45), 0.22, goal)
            line("Goal net support", (x, y, 0), (x, y + direction * 2.2, 1.1), 0.08, white)
    return grass_a


def add_ball():
    white = material("Ball · porcelain", (0.94, 0.96, 0.9), roughness=0.25)
    black = material("Ball · charcoal panels", (0.012, 0.022, 0.035), roughness=0.28)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.05, location=(-18, -4, 0.98))
    ball = bpy.context.object
    ball.name = "Original procedural football · no brand"
    ball.data.materials.append(white)
    ball.data.materials.append(black)
    for polygon in ball.data.polygons:
        if polygon.index % 8 in (0, 1):
            polygon.material_index = 1
        polygon.use_smooth = True
    ball.rotation_mode = "XYZ"
    for frame, x, y, spin in [(1, -18, -4, 0), (42, -4, 2, 3.4), (96, 12, 7, 7.4), (180, 23, 10, 11.2)]:
        ball.location = (x, y, 1.1)
        ball.rotation_euler = (spin, 0.3, spin * 0.75)
        ball.keyframe_insert(data_path="location", frame=frame)
        ball.keyframe_insert(data_path="rotation_euler", frame=frame)
    return ball


def add_camera(scene, width, height, fps, seconds):
    bpy.ops.object.camera_add(location=(94, -132, 108))
    camera = bpy.context.object
    camera.name = "TV camera · smooth cinematic orbit"
    camera.data.lens = 42
    scene.camera = camera
    keyframes = [
        (1, (94, -132, 108), (0, 0, 0)),
        (48, (73, -76, 63), (0, -4, 1)),
        (96, (40, -28, 36), (0, 2, 0)),
        (144, (-3, 25, 42), (2, 7, 1)),
        (180, (-50, 66, 70), (0, 0, 0)),
    ]
    scene.frame_end = max(2, int(seconds * fps))
    for frame, location, target in keyframes:
        camera.location = location
        look_at(camera, target)
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
    if camera.animation_data and camera.animation_data.action:
        for fcurve in camera.animation_data.action.fcurves:
            for key in fcurve.keyframe_points:
                key.interpolation = "BEZIER"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = 4
    return scene.frame_end


def main():
    args = args_after_double_dash()
    output = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    scene = bpy.context.scene
    scene.world.color = (0.006, 0.012, 0.03)
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    stadium(scene)
    add_ball()
    # Soft broadcast lighting, with cool floodlight edge accents.
    bpy.ops.object.light_add(type="AREA", location=(5, -8, 58))
    key = bpy.context.object
    key.name = "Broadcast key light"
    key.data.energy = 42000
    key.data.shape = "DISK"
    key.data.size = 75
    look_at(key, (0, 0, 0))
    bpy.ops.object.light_add(type="AREA", location=(-65, 18, 38))
    rim = bpy.context.object
    rim.name = "Cyan stadium rim light"
    rim.data.energy = 29000
    rim.data.color = (0.17, 0.65, 1.0)
    rim.data.size = 55
    look_at(rim, (0, 0, 3))
    bpy.ops.object.light_add(type="AREA", location=(55, 40, 30))
    fill = bpy.context.object
    fill.name = "Warm stand fill"
    fill.data.energy = 16000
    fill.data.color = (1.0, 0.68, 0.36)
    fill.data.size = 45
    look_at(fill, (0, 0, 2))
    frame_end = add_camera(scene, args.width, args.height, args.fps, args.seconds)
    # Camera-attached broadcast labels. These remain clear of the pitch and disclose the fictional scene.
    camera = scene.camera
    title_mat = material("Overlay · cyan", (0.22, 0.9, 1.0), emission=1.4)
    white_mat = material("Overlay · white", (0.93, 0.97, 1.0), emission=0.7)
    for name, body, location, size, mat in [
        ("Brand overlay", "FACTSPORT TV   /   MATCH STORY", (-5.45, 2.95, -13.0), 0.40, title_mat),
        ("Episode title overlay", "CINEMATIC 3D LOOK-DEV", (-5.45, 2.30, -13.0), 0.66, white_mat),
        ("Disclosure overlay", "FICTIONAL SCENE  ·  ILLUSTRATIVE  ·  NOT MATCH FOOTAGE", (-5.45, -3.15, -13.0), 0.30, title_mat),
    ]:
        bpy.ops.object.text_add()
        text_obj = bpy.context.object
        text_obj.name = name
        text_obj.data.body = body
        text_obj.data.size = size
        text_obj.data.extrude = 0.003
        text_obj.data.materials.append(mat)
        text_obj.parent = camera
        text_obj.location = location
        text_obj.rotation_euler = (0, 0, 0)

    # Slight depth of field is intentionally disabled for clean, legible broadcast lines.
    scene.render.filepath = os.path.join(tempfile.gettempdir(), "factsport-tv-3d-frame-")
    scene.camera.data.lens = 40
    with tempfile.TemporaryDirectory(prefix="factsport-tv-blender-") as frame_dir:
        scene.render.filepath = os.path.join(frame_dir, "frame-")
        scene.render.image_settings.file_format = "PNG"
        subprocess.run(["blender", "--version"], check=True, stdout=subprocess.DEVNULL)
        for frame in range(1, frame_end + 1):
            scene.frame_set(frame)
            scene.render.filepath = os.path.join(frame_dir, f"frame-{frame:04d}.png")
            bpy.ops.render.render(write_still=True)
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", str(args.fps), "-i", os.path.join(frame_dir, "frame-%04d.png"),
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
        ], check=True)
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,avg_frame_rate",
        "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1", output,
    ], check=True, capture_output=True, text=True)
    print(f"Synthetic 3D look-dev preview created (not publishable): {output}\n{result.stdout.strip()}")


if __name__ == "__main__":
    main()
