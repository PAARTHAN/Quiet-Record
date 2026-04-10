import "./SectionHeader.css";

export default function SectionHeader({ title, description, action }) {
  return (
    <div className="section-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
