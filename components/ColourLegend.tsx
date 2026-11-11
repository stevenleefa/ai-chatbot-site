// One standard colour key for the owner area — the same colour always
// means the same thing, on /employees, /customers and /appointments:
//   People (customers + employees): deep purple
//   Money: dark grey
//   Appointments: dark navy
//   Products: medium grey
//   Services / procedures: medium purple
// The colours are defined once in app/globals.css (.tag-*); this row
// just shows the key where the colours are used. See EMPLOYEES.md.
export default function ColourLegend() {
  return (
    <p className="colour-legend">
      Colours:{" "}
      <span className="tag tag-people">People</span>{" "}
      <span className="tag tag-money">Money</span>{" "}
      <span className="tag tag-appointments">Appointments</span>{" "}
      <span className="tag tag-products">Products</span>{" "}
      <span className="tag tag-services">Services</span>
    </p>
  );
}
