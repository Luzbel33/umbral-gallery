export function bindJoystick(element, listen) {
  const stick = element.querySelector("span");
  const axis = { x: 0, y: 0 };
  let pointer = null,
    centerX = 0,
    centerY = 0,
    radius = 1;
  function move(event) {
    if (event.pointerId !== pointer) return;
    const x = event.clientX - centerX,
      y = event.clientY - centerY;
    const distance = Math.hypot(x, y);
    const magnitude = Math.min(distance / radius, 1);
    const gain = Math.max(0, (magnitude - 0.085) / 0.915);
    axis.x = distance ? (gain * x) / distance : 0;
    axis.y = distance ? (-gain * y) / distance : 0;
    const visual = Math.min(1, radius / (distance || 1));
    stick.style.transform = `translate(${x * visual}px, ${y * visual}px)`;
  }
  function reset() {
    pointer = null;
    axis.x = axis.y = 0;
    element.classList.remove("engaged");
    stick.style.removeProperty("transform");
  }
  listen(element, "pointerdown", (event) => {
    if (pointer !== null || event.button !== 0) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    radius = (rect.width - stick.offsetWidth) / 2;
    pointer = event.pointerId;
    element.setPointerCapture(pointer);
    element.classList.add("engaged");
    move(event);
  });
  listen(element, "pointermove", move);
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(element, name, (event) => {
      if (event.pointerId === pointer) reset();
    });
  listen(window, "blur", reset);
  listen(document, "visibilitychange", reset);
  return { axis, reset };
}
