// One standard colour key for the owner area — the same colour always
// means the same thing, on /employees, /customers and /appointments:
//   People (customers + employees): plum
//   Money: green
//   Appointments: blue
//   Products: orange
//   Services / procedures: rose
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
