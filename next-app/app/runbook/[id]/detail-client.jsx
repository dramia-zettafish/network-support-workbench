'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dagre from 'dagre';
import {
  ReactFlow,
  Handle,
  MiniMap,
  MarkerType,
  Panel,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStore
} from '@xyflow/react';

function processListFromResponse(data) {
  return Array.isArray(data) ? data : data?.data || [];
}

function normalizeProcessId(value) {
  return String(value || '').replace(/\.json$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}
const PROCESS_LIST_URL = "/runbook/processes";
const DEFAULT_TEAM = "Parts Administration";
const TEAM_OPTIONS = [
  "Parts Administration",
  "RMA Administrators",
  "Internal Support Technicians",
  "Computer Technicians"
];
const ACTION_NODE_WIDTH = 280;
const ACTION_NODE_HEIGHT = 88;
const DECISION_NODE_SIZE = 140;
const NOTE_NODE_WIDTH = 240;
const NOTE_NODE_HEIGHT = 72;
const JUNCTION_NODE_SIZE = 1;
const LAYOUT_CONFIG = {
  rankdir: "TB",
  ranksep: 90,
  nodesep: 60
};
const EDGE_PATH_OPTIONS = { offset: 32, borderRadius: 20 };
const EDGE_LABEL_STYLE = { fill: "var(--text-primary)", fontSize: 12, fontWeight: 600 };
const EDGE_LABEL_BG_STYLE = { fill: "var(--bg-secondary)" };
const EDGE_LABEL_PADDING = [8, 4];
const DEFAULT_ZOOM = 1;
const OVERLAY_PADDING = 10;
const OVERLAY_GAP = 8;
const MINIMAP_FRACTION = 0.15;
const MINIMAP_MIN_WIDTH = 160;
const MINIMAP_MAX_WIDTH = 230;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getToken = () => {
  try {
    return window.localStorage.getItem("token");
  } catch (err) {
    return null;
  }
};

const normalizeTeams = (raw) => {
  if (!Array.isArray(raw)) return [DEFAULT_TEAM];
  const cleaned = raw
    .filter((team) => typeof team === "string")
    .map((team) => team.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  cleaned.forEach((team) => {
    const key = team.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(team);
  });
  return out.length ? out : [DEFAULT_TEAM];
};

const formatTeamsSummary = (raw) => {
  const teams = normalizeTeams(raw);
  if (teams.length <= 2) return teams.join(", ");
  return `${teams[0]}, ${teams[1]} +${teams.length - 2}`;
};

const formatImageAlt = (filename, step) => {
  if (!filename) return step ? `Step ${step} screenshot` : "Process screenshot";
  const base = filename.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  return step ? `Step ${step}: ${base}` : base;
};

const parseHash = () => {
  const raw = (window.location.hash || "").replace("#", "");
  const [tab, processId] = raw.split("/");
  return {
    tab: tab || "",
    processId: processId || null
  };
};

const ActionNode = ({ data }) => {
  const classes = ["pf-node", "pf-node--action"];
  if (data.isEnd) classes.push("pf-node--end");
  if (data.isSelected) classes.push("pf-node--selected");

  return (
    <div className={classes.join(" ")}>
      <Handle type="target" position={Position.Top} className="pf-handle" />
      <div className="pf-node__label">{data.label}</div>
      {data.system ? <div className="pf-node__meta">{data.system}</div> : null}
      <Handle type="source" position={Position.Bottom} className="pf-handle" />
    </div>
  );
};

const DecisionNode = ({ data }) => {
  const classes = ["pf-node", "pf-node--decision"];
  if (data.isSelected) classes.push("pf-node--selected");

  const cornerOffset = 6;
  const cornerStyles = {
    top: { left: "50%", top: -cornerOffset, transform: "translate(-50%, -50%)" },
    right: { top: "50%", right: -cornerOffset, transform: "translate(50%, -50%)" },
    left: { top: "50%", left: -cornerOffset, transform: "translate(-50%, -50%)" }
  };

  return (
    <div className={classes.join(" ")}>
      <Handle
        type="target"
        id="in"
        position={Position.Top}
        className="pf-handle"
        style={cornerStyles.top}
      />
      <Handle
        type="source"
        id="no"
        position={Position.Left}
        className="pf-handle"
        style={cornerStyles.left}
      />
      <Handle
        type="source"
        id="yes"
        position={Position.Right}
        className="pf-handle"
        style={cornerStyles.right}
      />
      <div className="pf-node__diamond">
        <div className="pf-node__label">{data.label}</div>
      </div>
    </div>
  );
};

const NoteNode = ({ data }) => {
  const hasLink = data.noteLinkHref && data.noteLinkLabel;
  const handlePosition = data.notePosition === "left" ? Position.Right : Position.Left;
  return (
    <div className="pf-node pf-node--note">
      <Handle type="target" position={handlePosition} className="pf-handle pf-handle--note" />
      <div className="pf-node__note-type">{data.noteType || "Note"}</div>
      <div className="pf-node__label">
        {data.label}
        {hasLink ? (
          <>
            {" "}
            <a className="pf-node__link" href={data.noteLinkHref}>
              {data.noteLinkLabel}
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
};

const JunctionNode = () => {
  return (
    <div className="pf-node--junction">
      <Handle type="target" id="in" position={Position.Top} className="pf-handle" style={{ opacity: 0 }} />
      <Handle
        type="source"
        id="out"
        position={Position.Bottom}
        className="pf-handle"
        style={{ opacity: 0 }}
      />
    </div>
  );
};

const nodeTypes = {
  action: ActionNode,
  decision: DecisionNode,
  note: NoteNode,
  junction: JunctionNode
};

const FlowViewportOverlay = React.memo(function FlowViewportOverlay({ bounds }) {
  const { fitBounds, setCenter, zoomIn, zoomOut } = useReactFlow();
  const flowWidth = useStore((state) => state.width);

  const minimapWidth = useMemo(() => {
    if (!flowWidth) return MINIMAP_MIN_WIDTH;
    return Math.round(clamp(flowWidth * MINIMAP_FRACTION, MINIMAP_MIN_WIDTH, MINIMAP_MAX_WIDTH));
  }, [flowWidth]);

  const minimapHeight = useMemo(() => Math.round(minimapWidth * 0.72), [minimapWidth]);

  const showMinimap = useStore(
    useCallback(
      (state) => {
        if (!bounds || !state.width || !state.height) return false;
        const zoom = state.transform[2] || 1;
        const viewBounds = {
          x: -state.transform[0] / zoom,
          y: -state.transform[1] / zoom,
          width: state.width / zoom,
          height: state.height / zoom
        };
        const epsilon = 0.5;
        const fitsHorizontally =
          bounds.x >= viewBounds.x - epsilon &&
          bounds.x + bounds.width <= viewBounds.x + viewBounds.width + epsilon;
        const fitsVertically =
          bounds.y >= viewBounds.y - epsilon &&
          bounds.y + bounds.height <= viewBounds.y + viewBounds.height + epsilon;
        return !(fitsHorizontally && fitsVertically);
      },
      [bounds]
    )
  );

  const minimapStyle = useMemo(
    () => ({
      width: minimapWidth,
      height: minimapHeight,
      top: OVERLAY_PADDING,
      right: OVERLAY_PADDING,
      margin: 0,
      zIndex: 20
    }),
    [minimapHeight, minimapWidth]
  );

  const controlsTop = showMinimap
    ? OVERLAY_PADDING + minimapHeight + OVERLAY_GAP
    : OVERLAY_PADDING;

  const controlsStyle = useMemo(
    () => ({
      top: controlsTop,
      right: OVERLAY_PADDING,
      margin: 0,
      zIndex: 20
    }),
    [controlsTop]
  );

  const handleFit = useCallback(() => {
    if (!bounds) return;
    fitBounds(bounds, { padding: 0.08, duration: 200 });
  }, [bounds, fitBounds]);

  const handleMinimapClick = useCallback(
    (_event, position) => {
      setCenter(position.x, position.y, { duration: 150 });
    },
    [setCenter]
  );

  return (
    <>
      {showMinimap ? (
        <MiniMap
          position="top-right"
          className="pf-flow-minimap"
          style={minimapStyle}
          pannable
          zoomable={false}
          bgColor="transparent"
          nodeColor="rgba(100, 116, 139, 0.22)"
          nodeStrokeColor="rgba(71, 85, 105, 0.32)"
          maskColor="rgba(241, 245, 249, 0.64)"
          maskStrokeColor="var(--accent-secondary)"
          maskStrokeWidth={2}
          onClick={handleMinimapClick}
        />
      ) : null}
      <Panel position="top-right" className="pf-flow-zoom-panel" style={controlsStyle}>
        <button
          type="button"
          className="pf-flow-zoom-button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => zoomIn({ duration: 120 })}
        >
          +
        </button>
        <button
          type="button"
          className="pf-flow-zoom-button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoomOut({ duration: 120 })}
        >
          -
        </button>
        <button
          type="button"
          className="pf-flow-zoom-button pf-flow-zoom-button--fit"
          aria-label="Fit diagram to view"
          title="Fit to view"
          onClick={handleFit}
          disabled={!bounds}
        >
          Fit
        </button>
      </Panel>
    </>
  );
});

const FlowDrawer = ({ node }) => {
  if (!node) {
    return (
      <div className="process-flow-drawer">
        <h3>Step Details</h3>
        <p className="muted">Select a step to see details.</p>
      </div>
    );
  }

  return (
    <div className="process-flow-drawer">
      <h3>{node.label}</h3>
      {node.step ? <p className="muted">Step {node.step}</p> : null}
      {node.role ? (
        <p>
          <strong>Role:</strong> {node.role}
        </p>
      ) : null}
      {node.system ? (
        <p>
          <strong>System:</strong> {node.system}
        </p>
      ) : null}
      {node.details && node.details.length ? (
        <>
          <h4>Details</h4>
          <ul>
            {node.details
              .map((item, idx) => {
                if (typeof item === "string") {
                  return (
                    <li key={`${node.id}-detail-${idx}`}>
                      {item}
                    </li>
                  );
                }
                if (item && typeof item === "object" && typeof item.text === "string") {
                  const link =
                    item.linkLabel && item.linkHref ? (
                      <a className="process-flow-detail-link" href={item.linkHref}>
                        {item.linkLabel}
                      </a>
                    ) : null;
                  const body = link ? (
                    <>
                      {item.text}
                      {link}
                    </>
                  ) : (
                    item.text
                  );
                  const content = item.emphasis ? <em>{body}</em> : body;
                  const subItems = Array.isArray(item.subItems)
                    ? item.subItems.filter((sub) => typeof sub === "string" && sub.trim())
                    : [];
                  return (
                    <li key={`${node.id}-detail-${idx}`}>
                      {content}
                      {subItems.length ? (
                        <ul className="process-flow-detail-sublist">
                          {subItems.map((subItem, subIdx) => (
                            <li key={`${node.id}-detail-${idx}-${subIdx}`}>{subItem}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                }
                return null;
              })
              .filter(Boolean)}
          </ul>
        </>
      ) : null}
    </div>
  );
};

const StepScreenshots = ({ processData, node }) => {
  const media = processData?.media;
  const nodeKey = node?.id ? String(node.id) : null;
  const stepKey = node?.step ? String(node.step) : null;
  const imagesFromSteps = stepKey && media?.steps ? media.steps[stepKey] : null;
  const imagesFromNodes = !imagesFromSteps && nodeKey && media?.nodes ? media.nodes[nodeKey] : null;
  const images = imagesFromSteps || imagesFromNodes;
  const basePath = media?.basePath || "";
  const imageKey = stepKey || nodeKey || "process";
  const [activeImage, setActiveImage] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const openImage = (filename) => {
    setActiveImage(filename);
    setIsZoomed(false);
  };

  return (
    <div className="process-flow-drawer process-flow-screenshots">
      <h3>Visual Reference</h3>
      {!media ? (
        <p className="muted">No documentation available for this process.</p>
      ) : !node ? (
        <p className="muted">Select a step to view screenshots.</p>
      ) : !images || !images.length ? (
        <p className="muted">No screenshots for this step.</p>
      ) : (
        <div className="process-flow-thumbnails" role="list">
          {images.map((filename, idx) => (
            <button
              type="button"
              className="process-flow-thumbnail"
              key={`${imageKey}-${idx}`}
              onClick={() => openImage(filename)}
            >
              <img
                src={`${basePath}/${filename}`}
                alt={formatImageAlt(filename, stepKey)}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      {activeImage ? (
        <div
          className="process-flow-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onClick={() => setActiveImage(null)}
        >
          <button
            type="button"
            className="process-flow-lightbox__close"
            onClick={() => setActiveImage(null)}
            aria-label="Close image preview"
          >
            x
          </button>
          <div className="process-flow-lightbox__frame" onClick={(event) => event.stopPropagation()}>
            <img
              src={`${basePath}/${activeImage}`}
              alt={formatImageAlt(activeImage, stepKey)}
              className={`process-flow-lightbox__image${isZoomed ? " is-zoomed" : ""}`}
              onClick={() => setIsZoomed((prev) => !prev)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

const StepList = ({ processData, selectedNodeId, onSelectNode }) => {
  const processId = processData?.process?.id ? String(processData.process.id) : "";
  const [sparePartsIssuedAnswer, setSparePartsIssuedAnswer] = useState("No");
  const [orderedPartsArrivedAnswer, setOrderedPartsArrivedAnswer] = useState("Yes");

  useEffect(() => {
    if (processId === "receiving-parts") {
      setSparePartsIssuedAnswer("No");
      setOrderedPartsArrivedAnswer("Yes");
    }
  }, [processId]);

  const items = useMemo(() => {
    const nodes = processData.nodes.filter((node) => node.type !== "note");
    const edges = processData.edges;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map(nodes.map((node) => [node.id, []]));

    edges.forEach((edge) => {
      if (!byId.has(edge.source) || !byId.has(edge.target)) return;
      outgoing.get(edge.source).push(edge);
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    });

    const startCandidates = nodes.filter((node) => (incoming.get(node.id) || 0) === 0);
    const startNode =
      startCandidates.sort((a, b) => (a.stepOrder ?? 999) - (b.stepOrder ?? 999))[0] ||
      nodes[0];

    const getGroupKey = (node) => {
      if (node.listGroup) return node.listGroup;
      return node.id;
    };

    const sanitizeTaskTree = (tasks) => {
      if (!Array.isArray(tasks)) return [];
      const normalized = [];
      tasks.forEach((task) => {
        if (typeof task === "string") {
          const value = task.trim();
          if (value) normalized.push(value);
          return;
        }

        if (!task || typeof task !== "object") return;

        const text = typeof task.text === "string" ? task.text.trim() : "";
        if (!text) return;

        const childrenSource = task.subItems ?? task.subTasks ?? task.items;
        const subItems = sanitizeTaskTree(childrenSource);
        if (subItems.length) {
          normalized.push({ text, subItems });
        } else {
          normalized.push(text);
        }
      });
      return normalized;
    };

    const buildStepTitle = (group) => {
      const explicit = group.map((node) => node.listLabel).find(Boolean);
      if (explicit) return explicit;
      if (group.length === 1) return group[0].label;
      return group.map((node) => node.label).join("; ");
    };

    const buildSubTasks = (group) => {
      const detailsWithSubItems = group
        .map((node) => node.details)
        .find(
          (details) =>
            Array.isArray(details) &&
            details.some(
              (detail) =>
                detail &&
                typeof detail === "object" &&
                typeof detail.text === "string" &&
                Array.isArray(detail.subItems) &&
                detail.subItems.length
            )
        );

      if (detailsWithSubItems) {
        const normalizedDetails = sanitizeTaskTree(
          detailsWithSubItems
            .filter(
              (detail) =>
                detail &&
                typeof detail === "object" &&
                typeof detail.text === "string" &&
                Array.isArray(detail.subItems)
            )
            .map((detail) => ({ text: detail.text, subItems: detail.subItems }))
        );
        if (normalizedDetails.length) return normalizedDetails;
      }

      const explicitTasks = group.map((node) => node.tasks).find((tasks) => tasks?.length);
      const sanitizedExplicit = sanitizeTaskTree(explicitTasks);
      if (sanitizedExplicit.length) return sanitizedExplicit;
      if (group.length > 1) {
        const taskNodes = group
          .map((node) => ({
            text: node.label,
            nodeId: node.id
          }))
          .filter((task) => typeof task.text === "string" && task.text.trim());

        if (
          processId === "receiving-parts" &&
          taskNodes.some((task) => task.nodeId === "step-7") &&
          taskNodes.some((task) => task.nodeId === "step-7-label")
        ) {
          return taskNodes.filter((task) => task.nodeId !== "step-7");
        }

        return taskNodes;
      }
      return [];
    };

    const shouldSkip = (node) => !!node?.listHidden;

    const buildStepLabel = (group) => {
      const explicit = group.map((node) => node.listStepLabel).find(Boolean);
      if (explicit) return explicit;
      const steps = group
        .map((node) => node.step)
        .filter((step) => step !== undefined && step !== null)
        .map((step) => String(step));
      if (!steps.length) return null;
      if (steps.length > 1) {
        const prefixes = steps.map((step) => step.split(".")[0]);
        if (prefixes.every((prefix) => prefix === prefixes[0])) {
          return prefixes[0];
        }
      }
      const ordered = [...group].sort(
        (a, b) => (a.stepOrder ?? Number.MAX_VALUE) - (b.stepOrder ?? Number.MAX_VALUE)
      );
      return ordered[0]?.step ? String(ordered[0].step) : steps[0];
    };

    const walkBranch = (startId) => {
      const items = [];
      const branchVisited = new Set();
      let nodeId = startId;
      while (nodeId && !branchVisited.has(nodeId)) {
        const node = byId.get(nodeId);
        if (!node || node.type === "decision") break;
        items.push(node);
        branchVisited.add(nodeId);
        if (String(node.id).startsWith("end-")) break;
        const outs = outgoing.get(nodeId) || [];
        if (outs.length !== 1) break;
        nodeId = outs[0].target;
      }
      return items;
    };

	    const buildConditional = (decisionNode) => {
	      const decisionEdges = outgoing.get(decisionNode.id) || [];
	      const externalizeNoBranchFinalStep =
	        processId === "receiving-parts" && decisionNode.id === "decision-all-received";
      const matchBranch = (needle) => {
        const normalizedNeedle = String(needle).trim().toLowerCase();
        const labelMatch = decisionEdges.find((edge) => {
          const label = edge.label ? String(edge.label).trim().toLowerCase() : "";
          return label === normalizedNeedle;
        });
        if (labelMatch) return labelMatch;
        return (
          decisionEdges.find((edge) => {
            const handle = edge.sourceHandle ? String(edge.sourceHandle).trim().toLowerCase() : "";
            return handle === normalizedNeedle;
          }) || null
        );
      };

      const yesEdge = matchBranch("yes") || decisionEdges[0] || null;
      const noEdgeCandidate = matchBranch("no");
      const noEdge =
        noEdgeCandidate && noEdgeCandidate !== yesEdge
          ? noEdgeCandidate
          : decisionEdges.find((edge) => edge !== yesEdge) || null;

	      const yesItems = yesEdge ? walkBranch(yesEdge.target) : [];
	      const noItems = noEdge ? walkBranch(noEdge.target) : [];
	      const postStepNode =
	        externalizeNoBranchFinalStep && noItems.length > 1
	          ? noItems[noItems.length - 1]
	          : null;

      const decisionText = (() => {
        const override =
          typeof decisionNode.listDecisionText === "string"
            ? decisionNode.listDecisionText.trim()
            : "";
        if (override) return override;

        let text = decisionNode.label ? String(decisionNode.label).trim() : "";
        text = text.replace(/\?$/, "");
        if (text) {
          const lower = text.charAt(0).toLowerCase() + text.slice(1);
          return /^the\s/i.test(lower) ? lower : `the ${lower}`;
        }
        return "";
      })();

      const formatYesLines = () => {
        if (!yesItems.length) return [];
        const target = yesItems[0];
        return [
          { id: `yes-${target.id}`, label: `Continue: ${target.label}`, nodeId: target.id }
        ];
      };

	      const formatNoLines = () => {
	        if (!noItems.length) return [];
	        const lines = [];
	        if (noItems[0]) {
	          lines.push({
	            id: `no-action-${noItems[0].id}`,
	            label: `Action: ${noItems[0].label}`,
	            nodeId: noItems[0].id
	          });
	        }
	        if (noItems.length > 2) {
	          noItems.slice(1, -1).forEach((node) => {
	            lines.push({ id: `no-then-${node.id}`, label: `Then: ${node.label}`, nodeId: node.id });
	          });
	        }
	        if (noItems.length > 1) {
	          const last = noItems[noItems.length - 1];
	          if (postStepNode && last?.id === postStepNode.id) {
	            return lines;
	          }
	          if (last?.step) {
	            lines.push({
	              id: `no-step-${last.id}`,
	              kind: "step",
              nodeId: last.id,
              stepLabel: String(last.step),
              title: last.label,
              system: last.system ? String(last.system) : null
            });
          } else {
            lines.push({
              id: `no-status-${last.id}`,
              label: `Status: ${last.label}`,
              nodeId: last.id
            });
          }
        }
        return lines;
      };

      const continueNodeId = (() => {
        if (!yesEdge) return null;
        let nextId = yesEdge.target;
        let nextNode = byId.get(nextId);
        const seen = new Set();
        while (nextNode && (String(nextNode.id).startsWith("end-") || nextNode.type === "junction")) {
          if (seen.has(nextNode.id)) return null;
          seen.add(nextNode.id);
          const outs = outgoing.get(nextNode.id) || [];
          if (outs.length !== 1) return null;
          nextId = outs[0].target;
          nextNode = byId.get(nextId);
        }
        if (!nextNode) return null;
        if (nextNode.type === "decision") return nextId;

        if (yesItems.length) {
          const first = yesItems[0];
          if (!first || String(first.id).startsWith("end-")) return null;
          const outs = outgoing.get(first.id) || [];
          if (outs.length !== 1) return null;
          return outs[0].target;
        }

        return nextId;
      })();

      const filteredNoLines = (() => {
        const lines = formatNoLines();
        if (!continueNodeId || !lines.length) return lines;
        const lastLine = lines[lines.length - 1];
        if (
          lastLine &&
          typeof lastLine.nodeId === "string" &&
          lastLine.nodeId === continueNodeId
        ) {
          return lines.slice(0, -1);
        }
        return lines;
      })();

	      return {
	        decisionText,
	        yesLines: formatYesLines(),
	        noLines: filteredNoLines,
	        continueNodeId,
	        postSteps: postStepNode?.step ? [postStepNode.id] : []
	      };
	    };

    const buildDecisionText = (decisionNode) => {
      const override =
        typeof decisionNode.listDecisionText === "string"
          ? decisionNode.listDecisionText.trim()
          : "";
      if (override) return override;

      let text = decisionNode.label ? String(decisionNode.label).trim() : "";
      text = text.replace(/\?$/, "");
      if (!text) return "";
      const lower = text.charAt(0).toLowerCase() + text.slice(1);
      return /^the\s/i.test(lower) ? lower : `the ${lower}`;
    };

    function buildExpandedConditional(decisionNode) {
      const decisionEdges = outgoing.get(decisionNode.id) || [];
      const matchBranch = (needle) => {
        const normalizedNeedle = String(needle).trim().toLowerCase();
        const labelMatch = decisionEdges.find((edge) => {
          const label = edge.label ? String(edge.label).trim().toLowerCase() : "";
          return label === normalizedNeedle;
        });
        if (labelMatch) return labelMatch;
        return (
          decisionEdges.find((edge) => {
            const handle = edge.sourceHandle ? String(edge.sourceHandle).trim().toLowerCase() : "";
            return handle === normalizedNeedle;
          }) || null
        );
      };

      const yesEdge = matchBranch("yes") || decisionEdges[0] || null;
      const noEdgeCandidate = matchBranch("no");
      const noEdge =
        noEdgeCandidate && noEdgeCandidate !== yesEdge
          ? noEdgeCandidate
          : decisionEdges.find((edge) => edge !== yesEdge) || null;

      const yesStart = yesEdge ? byId.get(yesEdge.target) : null;
      const noStart = noEdge ? byId.get(noEdge.target) : null;

      return {
        decisionText: buildDecisionText(decisionNode),
        yesItems: yesStart ? buildItemsSequence(yesStart) : [],
        noItems: noStart ? buildItemsSequence(noStart) : []
      };
    }

	    function buildItemsSequence(start) {
	      const items = [];
	      const visited = new Set();
	      let current = start;

      while (current && !visited.has(current.id)) {
	        if (current.type === "decision") {
	          const data = current.listExpandBranches
	            ? buildExpandedConditional(current)
	            : buildConditional(current);
	          items.push({
	            type: "conditional",
	            id: current.id,
	            data: {
	              ...data,
	              decisionNodeId: current.id,
	              decisionLabel: current.label,
	              decisionStep: current.step ? String(current.step) : null,
	              decisionSystem: current.system ? String(current.system) : null
	            }
	          });
	          if (!current.listExpandBranches && Array.isArray(data.postSteps) && data.postSteps.length) {
	            data.postSteps.forEach((nodeId) => {
	              const node = byId.get(nodeId);
	              if (!node) return;
	              items.push({
	                type: "step",
	                id: node.id,
	                nodeId: node.id,
	                stepLabel: buildStepLabel([node]),
	                title: buildStepTitle([node]),
	                subTasks: buildSubTasks([node]),
	                system: node.system ? String(node.system) : null
	              });
	            });
	          }
	          visited.add(current.id);
	          if (current.listExpandBranches) break;
	          const nextNode = data.continueNodeId ? byId.get(data.continueNodeId) : null;
	          current = nextNode || null;
	          continue;
        }

        if (shouldSkip(current)) {
          visited.add(current.id);
          const outs = outgoing.get(current.id) || [];
          if (outs.length !== 1) break;
          current = byId.get(outs[0].target) || null;
          continue;
        }

        const groupKey = getGroupKey(current);
        const group = [current];
        visited.add(current.id);
        let last = current;

        while (true) {
          const outs = outgoing.get(last.id) || [];
          if (outs.length !== 1) break;
          const next = byId.get(outs[0].target);
          if (!next || next.type === "decision" || visited.has(next.id) || shouldSkip(next)) break;
          if (getGroupKey(next) !== groupKey) break;
          group.push(next);
          visited.add(next.id);
          last = next;
        }

        const systems = group.map((node) => node.system).filter(Boolean);
        const uniqueSystems = Array.from(new Set(systems));
        const orderedGroup = [...group].sort(
          (a, b) => (a.stepOrder ?? Number.MAX_VALUE) - (b.stepOrder ?? Number.MAX_VALUE)
        );
        const primaryNode = orderedGroup[0] || group[0];

        items.push({
          type: "step",
          id: group.map((node) => node.id).join("|"),
          nodeId: primaryNode ? primaryNode.id : null,
          stepLabel: buildStepLabel(group),
          title: buildStepTitle(group),
          subTasks: buildSubTasks(group),
          system: uniqueSystems.length ? uniqueSystems.join(" / ") : null
        });

        const outs = outgoing.get(last.id) || [];
        if (outs.length !== 1) break;
        current = byId.get(outs[0].target) || null;
      }

      return items;
    }

    return buildItemsSequence(startNode);
  }, [processData.edges, processData.nodes]);

  const renderTaskTree = (tasks, keyPrefix, { nested = false } = {}) => {
    if (!Array.isArray(tasks) || !tasks.length) return null;
    return (
      <ul
        className={`process-flow-step-subtasks${nested ? " process-flow-step-subtasks--nested" : ""}`}
      >
        {tasks.map((task, idx) => {
          if (typeof task === "string") {
            return <li key={`${keyPrefix}-task-${idx}`}>{task}</li>;
          }
          if (!task || typeof task !== "object" || typeof task.text !== "string") return null;
          const taskNodeId = typeof task.nodeId === "string" ? task.nodeId : null;
          const children = Array.isArray(task.subItems) ? task.subItems : [];
          return (
            <li key={`${keyPrefix}-task-${idx}`}>
              {taskNodeId && onSelectNode ? (
                <button
                  type="button"
                  className="process-flow-step-subtask-button"
                  onClick={() => onSelectNode(taskNodeId)}
                >
                  {task.text}
                </button>
              ) : (
                task.text
              )}
              {children.length
                ? renderTaskTree(children, `${keyPrefix}-task-${idx}`, { nested: true })
                : null}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderItemsList = (itemsToRender, { nested = false } = {}) => {
    const lastConditionalIndex = itemsToRender.reduce((acc, item, index) => {
      if (item?.type === "conditional") return index;
      return acc;
    }, -1);

    const renderedItems = [];
    for (let idx = 0; idx < itemsToRender.length; idx += 1) {
      const item = itemsToRender[idx];

      if (
        !nested &&
        processId === "receiving-parts" &&
        item.type === "step" &&
        item.nodeId === "step-5"
      ) {
        const next = itemsToRender[idx + 1];
        if (
          next?.type === "conditional" &&
          next.id === "decision-spare-parts" &&
          Array.isArray(next.data?.yesItems) &&
          Array.isArray(next.data?.noItems)
        ) {
          const isActive = item.nodeId && item.nodeId === selectedNodeId;
          const branchItems =
            sparePartsIssuedAnswer === "Yes" ? next.data.yesItems : next.data.noItems;

          renderedItems.push(
            <li key={`${item.id}-decision`} className="process-flow-step-item">
              <div className="process-flow-step-main">
                <button
                  type="button"
                  className={`process-flow-step-button${isActive ? " is-active" : ""}`}
                  onClick={() => (item.nodeId ? onSelectNode?.(item.nodeId) : null)}
                  disabled={!onSelectNode || !item.nodeId}
                >
                  {item.stepLabel ? (
                    <span className="process-flow-step-number">{item.stepLabel}</span>
                  ) : null}
                  <span className="process-flow-step-label">{item.title}</span>
                  {item.system ? (
                    <span
                      className="process-flow-step-system"
                      aria-label={`System ${item.system}`}
                    >
                      {item.system}
                    </span>
                  ) : null}
                </button>
              </div>
              {renderTaskTree(item.subTasks, item.id)}
              <div className="process-flow-step-decision">
                <label htmlFor="process-flow-spare-parts-issued">Spare Parts Issued?</label>
                <select
                  id="process-flow-spare-parts-issued"
                  value={sparePartsIssuedAnswer}
                  onChange={(event) => setSparePartsIssuedAnswer(event.target.value)}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div
                className={`process-flow-step-branch${
                  sparePartsIssuedAnswer === "No" ? " process-flow-step-branch--flush" : ""
                }`}
              >
                {renderItemsList(branchItems, { nested: true })}
              </div>
            </li>
          );

          idx += 1;
          continue;
        }
      }

      if (item.type === "conditional") {
        const conditional = item.data;
        const yesItems = Array.isArray(conditional.yesItems) ? conditional.yesItems : null;
        const noItems = Array.isArray(conditional.noItems) ? conditional.noItems : null;
        const yesLines = Array.isArray(conditional.yesLines) ? conditional.yesLines : [];
        const noLines = Array.isArray(conditional.noLines) ? conditional.noLines : [];
        const decisionNodeId = conditional.decisionNodeId;
        const isDecisionActive = decisionNodeId && decisionNodeId === selectedNodeId;

        if (processId === "receiving-parts" && item.id === "decision-all-received") {
          const showNext = true;
          const candidates = itemsToRender.slice(idx + 1, idx + 4);
          let backorderItem = null;
          let proceedItem = null;
          let lastConsumedIdx = idx;
          candidates.forEach((candidate, offset) => {
            const candidateIdx = idx + 1 + offset;
            if (candidate?.type !== "step") return;
            if (candidate.nodeId === "step-10") {
              backorderItem = candidate;
              lastConsumedIdx = Math.max(lastConsumedIdx, candidateIdx);
            }
            if (candidate.nodeId === "step-11") {
              proceedItem = candidate;
              lastConsumedIdx = Math.max(lastConsumedIdx, candidateIdx);
            }
          });

          const selectedItem =
            orderedPartsArrivedAnswer === "Yes" ? proceedItem || backorderItem : backorderItem || proceedItem;

          renderedItems.push(
            <li key={item.id} className="process-flow-conditional-item">
              <div className="process-flow-conditional" role="note">
                <div className="process-flow-conditional-title">Conditional Check</div>
                {conditional.decisionLabel ? (
                  <div className="process-flow-conditional-decision">
                    <button
                      type="button"
                      className={`process-flow-step-button${isDecisionActive ? " is-active" : ""}`}
                      onClick={() => (decisionNodeId ? onSelectNode?.(decisionNodeId) : null)}
                      disabled={!onSelectNode || !decisionNodeId}
                    >
                      {conditional.decisionStep ? (
                        <span className="process-flow-step-number">{conditional.decisionStep}</span>
                      ) : null}
                      <span className="process-flow-step-label">{conditional.decisionLabel}</span>
                      {conditional.decisionSystem ? (
                        <span
                          className="process-flow-step-system"
                          aria-label={`System ${conditional.decisionSystem}`}
                        >
                          {conditional.decisionSystem}
                        </span>
                      ) : null}
                    </button>
                  </div>
                ) : null}
                <div className="process-flow-conditional-row">
                  <span className="process-flow-conditional-tag">IF</span>
                  <span>{conditional.decisionText}:</span>
                </div>
                {yesItems ? (
                  <div className="process-flow-conditional-nested">
                    {renderItemsList(yesItems, { nested: true })}
                  </div>
                ) : (
                  <ul className="process-flow-conditional-list">
                    {yesLines.map((line) => (
                      <li key={line.id}>
                        {line.kind === "step" ? (
                          <button
                            type="button"
                            className={`process-flow-step-button${
                              line.nodeId === selectedNodeId ? " is-active" : ""
                            }`}
                            onClick={() => (line.nodeId ? onSelectNode?.(line.nodeId) : null)}
                            disabled={!onSelectNode || !line.nodeId}
                          >
                            {line.stepLabel ? (
                              <span className="process-flow-step-number">{line.stepLabel}</span>
                            ) : null}
                            <span className="process-flow-step-label">{line.title}</span>
                            {line.system ? (
                              <span className="process-flow-step-system" aria-label={`System ${line.system}`}>
                                {line.system}
                              </span>
                            ) : null}
                          </button>
                        ) : line.nodeId && onSelectNode ? (
                          <button
                            type="button"
                            className="process-flow-conditional-link"
                            onClick={() => onSelectNode(line.nodeId)}
                          >
                            {line.label}
                          </button>
                        ) : (
                          line.label
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="process-flow-conditional-row">
                  <span className="process-flow-conditional-tag">ELSE</span>
                </div>
                {noItems ? (
                  <div className="process-flow-conditional-nested">
                    {renderItemsList(noItems, { nested: true })}
                  </div>
                ) : (
                  <ul className="process-flow-conditional-list">
                    {noLines.map((line) => (
                      <li key={line.id}>
                        {line.kind === "step" ? (
                          <button
                            type="button"
                            className={`process-flow-step-button${
                              line.nodeId === selectedNodeId ? " is-active" : ""
                            }`}
                            onClick={() => (line.nodeId ? onSelectNode?.(line.nodeId) : null)}
                            disabled={!onSelectNode || !line.nodeId}
                          >
                            {line.stepLabel ? (
                              <span className="process-flow-step-number">{line.stepLabel}</span>
                            ) : null}
                            <span className="process-flow-step-label">{line.title}</span>
                            {line.system ? (
                              <span className="process-flow-step-system" aria-label={`System ${line.system}`}>
                                {line.system}
                              </span>
                            ) : null}
                          </button>
                        ) : line.nodeId && onSelectNode ? (
                          <button
                            type="button"
                            className="process-flow-conditional-link"
                            onClick={() => onSelectNode(line.nodeId)}
                          >
                            {line.label}
                          </button>
                        ) : (
                          line.label
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {showNext ? (
                  <div className="process-flow-conditional-next">
                    <em>Next</em>
                  </div>
                ) : null}
              </div>

              <div className="process-flow-step-decision process-flow-step-decision--conditional">
                <label htmlFor="process-flow-all-parts-arrived">All parts have arrived?</label>
                <select
                  id="process-flow-all-parts-arrived"
                  value={orderedPartsArrivedAnswer}
                  onChange={(event) => setOrderedPartsArrivedAnswer(event.target.value)}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </li>
          );

          if (selectedItem) {
            const isActive = selectedItem.nodeId && selectedItem.nodeId === selectedNodeId;
            renderedItems.push(
              <li key={selectedItem.id} className="process-flow-step-item">
                <div className="process-flow-step-main">
                  <button
                    type="button"
                    className={`process-flow-step-button${isActive ? " is-active" : ""}`}
                    onClick={() => (selectedItem.nodeId ? onSelectNode?.(selectedItem.nodeId) : null)}
                    disabled={!onSelectNode || !selectedItem.nodeId}
                  >
                    {selectedItem.stepLabel ? (
                      <span className="process-flow-step-number">{selectedItem.stepLabel}</span>
                    ) : null}
                    <span className="process-flow-step-label">{selectedItem.title}</span>
                    {selectedItem.system ? (
                      <span
                        className="process-flow-step-system"
                        aria-label={`System ${selectedItem.system}`}
                      >
                        {selectedItem.system}
                      </span>
                    ) : null}
                  </button>
                </div>
                {renderTaskTree(selectedItem.subTasks, selectedItem.id)}
              </li>
            );
          }

          idx = lastConsumedIdx;
          continue;
        }

        renderedItems.push(
          <li key={item.id} className="process-flow-conditional-item">
            <div className="process-flow-conditional" role="note">
              <div className="process-flow-conditional-title">Conditional Check</div>
              {conditional.decisionLabel ? (
                <div className="process-flow-conditional-decision">
                  <button
                    type="button"
                    className={`process-flow-step-button${isDecisionActive ? " is-active" : ""}`}
                    onClick={() => (decisionNodeId ? onSelectNode?.(decisionNodeId) : null)}
                    disabled={!onSelectNode || !decisionNodeId}
                  >
                    {conditional.decisionStep ? (
                      <span className="process-flow-step-number">{conditional.decisionStep}</span>
                    ) : null}
                    <span className="process-flow-step-label">{conditional.decisionLabel}</span>
                    {conditional.decisionSystem ? (
                      <span
                        className="process-flow-step-system"
                        aria-label={`System ${conditional.decisionSystem}`}
                      >
                        {conditional.decisionSystem}
                      </span>
                    ) : null}
                  </button>
                </div>
              ) : null}
              <div className="process-flow-conditional-row">
                <span className="process-flow-conditional-tag">IF</span>
                <span>{conditional.decisionText}:</span>
              </div>
              {yesItems ? (
                <div className="process-flow-conditional-nested">
                  {renderItemsList(yesItems, { nested: true })}
                </div>
              ) : (
                <ul className="process-flow-conditional-list">
                  {yesLines.map((line) => (
                    <li key={line.id}>
                      {line.kind === "step" ? (
                        <button
                          type="button"
                          className={`process-flow-step-button${
                            line.nodeId === selectedNodeId ? " is-active" : ""
                          }`}
                          onClick={() => (line.nodeId ? onSelectNode?.(line.nodeId) : null)}
                          disabled={!onSelectNode || !line.nodeId}
                        >
                          {line.stepLabel ? (
                            <span className="process-flow-step-number">{line.stepLabel}</span>
                          ) : null}
                          <span className="process-flow-step-label">{line.title}</span>
                          {line.system ? (
                            <span
                              className="process-flow-step-system"
                              aria-label={`System ${line.system}`}
                            >
                              {line.system}
                            </span>
                          ) : null}
                        </button>
                      ) : line.nodeId && onSelectNode ? (
                        <button
                          type="button"
                          className="process-flow-conditional-link"
                          onClick={() => onSelectNode(line.nodeId)}
                        >
                          {line.label}
                        </button>
                      ) : (
                        line.label
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="process-flow-conditional-row">
                <span className="process-flow-conditional-tag">ELSE</span>
              </div>
              {noItems ? (
                <div className="process-flow-conditional-nested">
                  {renderItemsList(noItems, { nested: true })}
                </div>
              ) : (
                <ul className="process-flow-conditional-list">
                  {noLines.map((line) => (
                    <li key={line.id}>
                      {line.kind === "step" ? (
                        <button
                          type="button"
                          className={`process-flow-step-button${
                            line.nodeId === selectedNodeId ? " is-active" : ""
                          }`}
                          onClick={() => (line.nodeId ? onSelectNode?.(line.nodeId) : null)}
                          disabled={!onSelectNode || !line.nodeId}
                        >
                          {line.stepLabel ? (
                            <span className="process-flow-step-number">{line.stepLabel}</span>
                          ) : null}
                          <span className="process-flow-step-label">{line.title}</span>
                          {line.system ? (
                            <span
                              className="process-flow-step-system"
                              aria-label={`System ${line.system}`}
                            >
                              {line.system}
                            </span>
                          ) : null}
                        </button>
                      ) : line.nodeId && onSelectNode ? (
                        <button
                          type="button"
                          className="process-flow-conditional-link"
                          onClick={() => onSelectNode(line.nodeId)}
                        >
                          {line.label}
                        </button>
                      ) : (
                        line.label
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {processId === "receiving-parts" ||
              idx !== lastConditionalIndex ||
              (processId === "doa-parts" && item.id === "decision-return") ? (
                <div className="process-flow-conditional-next">
                  <em>
                    {processId === "doa-parts" && item.id === "decision-return"
                      ? "Next (unless no return was required)"
                      : "Next"}
                  </em>
                </div>
              ) : null}
            </div>
          </li>
        );
        continue;
      }

      const isActive = item.nodeId && item.nodeId === selectedNodeId;
      renderedItems.push(
        <li key={item.id} className="process-flow-step-item">
          <div className="process-flow-step-main">
            <button
              type="button"
              className={`process-flow-step-button${isActive ? " is-active" : ""}`}
              onClick={() => (item.nodeId ? onSelectNode?.(item.nodeId) : null)}
              disabled={!onSelectNode || !item.nodeId}
            >
              {item.stepLabel ? <span className="process-flow-step-number">{item.stepLabel}</span> : null}
              <span className="process-flow-step-label">{item.title}</span>
              {item.system ? (
                <span className="process-flow-step-system" aria-label={`System ${item.system}`}>
                  {item.system}
                </span>
              ) : null}
            </button>
          </div>
          {renderTaskTree(item.subTasks, item.id)}
        </li>
      );
    }

    return (
      <ol className={`process-flow-step-ol${nested ? " process-flow-step-ol--nested" : ""}`}>
        {renderedItems}
      </ol>
    );
  };

  return (
    <section className="process-flow-step-list" aria-label="Step List">
      <h3>Step List</h3>
      {renderItemsList(items)}
    </section>
  );
};

const FlowShell = ({ processData, viewMode }) => {
  const {
    getEdges,
    getNodes,
    setViewport
  } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const flowWrapperRef = useRef(null);
  const autoCenteredRef = useRef(false);
  const processKey = processData.process?.id || "process-flow";

  const mainlineNodeIds = useMemo(() => {
    const ordered = processData.nodes
      .filter((node) => typeof node.stepOrder === "number")
      .sort((a, b) => a.stepOrder - b.stepOrder);
    const decisionIndex = ordered.findIndex((node) => node.type === "decision");
    const mainline = decisionIndex >= 0 ? ordered.slice(0, decisionIndex + 1) : ordered;
    return new Set(mainline.map((node) => node.id));
  }, [processData.nodes]);

  const decisionNodeId = useMemo(() => {
    const decisionNode = processData.nodes.find((node) => node.type === "decision");
    return decisionNode ? decisionNode.id : null;
  }, [processData.nodes]);

  const decisionNodeIds = useMemo(() => {
    return processData.nodes.filter((node) => node.type === "decision").map((node) => node.id);
  }, [processData.nodes]);

  const resolveNodeSize = useCallback((node) => {
    const fallback =
      node.type === "decision"
        ? { width: DECISION_NODE_SIZE, height: DECISION_NODE_SIZE }
        : node.type === "note"
          ? { width: NOTE_NODE_WIDTH, height: NOTE_NODE_HEIGHT }
        : node.type === "junction"
          ? { width: JUNCTION_NODE_SIZE, height: JUNCTION_NODE_SIZE }
            : { width: ACTION_NODE_WIDTH, height: ACTION_NODE_HEIGHT };
    return {
      width: node.width ?? fallback.width,
      height: node.height ?? fallback.height
    };
  }, []);

  const graphElements = useMemo(() => {
    const decisionIds = new Set(
      processData.nodes.filter((node) => node.type === "decision").map((node) => node.id)
    );
    const baseNodes = processData.nodes.map((node) => {
      const isDecision = node.type === "decision";
      const isNote = node.type === "note";
      return {
        id: node.id,
        type: isDecision ? "decision" : isNote ? "note" : "action",
        position: { x: 0, y: 0 },
        data: {
          id: node.id,
          label: node.label,
          role: node.role,
          system: node.system,
          details: node.details || [],
          tags: node.tags || [],
          step: node.step,
          isEnd: node.id.startsWith("end-"),
          noteType: node.noteType,
          isNote,
          noteLinkLabel: node.noteLinkLabel,
          noteLinkHref: node.noteLinkHref,
          notePosition: node.notePosition,
          branchOffset: node.branchOffset,
          branchOffsetByHandle: node.branchOffsetByHandle,
          alignWith: node.alignWith,
          alignOffset: node.alignOffset,
          alignPhase: node.alignPhase,
          branchAlign: node.branchAlign,
          branchAlignRef: node.branchAlignRef,
          branchJunctionOffset: node.branchJunctionOffset,
          branchTargetOffset: node.branchTargetOffset
        },
        style: isDecision
          ? { width: DECISION_NODE_SIZE, height: DECISION_NODE_SIZE }
          : isNote
            ? { width: NOTE_NODE_WIDTH, height: NOTE_NODE_HEIGHT }
            : { width: ACTION_NODE_WIDTH },
        selectable: !isNote,
        draggable: false,
        connectable: false,
        focusable: !isNote
      };
    });

    const junctionNodes = [];
    const junctionIds = new Set();

    const buildEdge = (edge) => {
      const hasLabel = edge.label !== undefined && edge.label !== null && edge.label !== "";
      const isAnnotation = edge.kind === "annotation";
      const nextEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: isAnnotation ? "straight" : "smoothstep",
        pathOptions: EDGE_PATH_OPTIONS,
        markerEnd: isAnnotation
          ? undefined
          : {
              type: MarkerType.ArrowClosed
            },
        className: isAnnotation ? "pf-edge--annotation" : "",
        data: { isAnnotation }
      };
      if (hasLabel) {
        nextEdge.label = edge.label;
        nextEdge.labelShowBg = true;
        nextEdge.labelBgPadding = EDGE_LABEL_PADDING;
        nextEdge.labelBgBorderRadius = 999;
        nextEdge.labelBgStyle = EDGE_LABEL_BG_STYLE;
        nextEdge.labelStyle = EDGE_LABEL_STYLE;
      }
      return nextEdge;
    };

    const baseEdges = [];
    processData.edges.forEach((edge) => {
      const labelText = edge.label ? String(edge.label).trim() : "";
      const handleHint = edge.sourceHandle
        ? String(edge.sourceHandle).trim().toLowerCase()
        : labelText.toLowerCase();
      const isDecisionSplit =
        decisionIds.has(edge.source) && (handleHint === "yes" || handleHint === "no");

      if (isDecisionSplit) {
        const handleId = handleHint;
        const displayLabel = labelText || (handleHint === "yes" ? "Yes" : "No");
        const junctionId = `junction-${edge.source}-${handleId}`;
        if (!junctionIds.has(junctionId)) {
          junctionIds.add(junctionId);
          junctionNodes.push({
            id: junctionId,
            type: "junction",
            position: { x: 0, y: 0 },
            data: { isJunction: true },
            style: { width: JUNCTION_NODE_SIZE, height: JUNCTION_NODE_SIZE },
            selectable: false,
            draggable: false,
            connectable: false,
            focusable: false
          });
        }
        baseEdges.push(
          buildEdge({
            id: `${edge.id}-junction`,
            source: edge.source,
            target: junctionId,
            sourceHandle: handleId,
            targetHandle: "in",
            label: displayLabel
          })
        );
        baseEdges.push(
          buildEdge({
            id: `${edge.id}-out`,
            source: junctionId,
            target: edge.target,
            sourceHandle: "out"
          })
        );
        return;
      }

      baseEdges.push(
        buildEdge({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          label: edge.label,
          kind: edge.kind
        })
      );
    });

    return { nodes: [...baseNodes, ...junctionNodes], edges: baseEdges };
  }, [processData.edges, processData.nodes]);

  useEffect(() => {
    setNodes(graphElements.nodes);
    setEdges(graphElements.edges);
    autoCenteredRef.current = false;
  }, [graphElements.edges, graphElements.nodes, setEdges, setNodes]);

  const applyLayout = useCallback(
    ({ recenter = false } = {}) => {
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph(LAYOUT_CONFIG);

      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const layoutNodeIds = new Set(
        currentNodes.filter((node) => node.type !== "note").map((node) => node.id)
      );

      currentNodes.forEach((node) => {
        if (!layoutNodeIds.has(node.id)) return;
        const size = resolveNodeSize(node);
        dagreGraph.setNode(node.id, size);
      });

      currentEdges.forEach((edge) => {
        if (edge.data?.isAnnotation) return;
        if (!layoutNodeIds.has(edge.source) || !layoutNodeIds.has(edge.target)) return;
        dagreGraph.setEdge(edge.source, edge.target);
      });

      dagre.layout(dagreGraph);

      let nextNodes = currentNodes.map((node) => {
        const size = resolveNodeSize(node);
        const layoutNode = dagreGraph.node(node.id);
        if (!layoutNode) return node;
        return {
          ...node,
          position: {
            x: layoutNode.x - size.width / 2,
            y: layoutNode.y - size.height / 2
          }
        };
      });

      let targetCenterX = null;
      if (decisionNodeId) {
        const decisionLayout = dagreGraph.node(decisionNodeId);
        if (decisionLayout) targetCenterX = decisionLayout.x;
      }
      if (targetCenterX === null && mainlineNodeIds.size) {
        const centers = nextNodes
          .filter((node) => mainlineNodeIds.has(node.id))
          .map((node) => {
            const size = resolveNodeSize(node);
            return node.position.x + size.width / 2;
          });
        if (centers.length) {
          targetCenterX = centers.reduce((sum, value) => sum + value, 0) / centers.length;
        }
      }
      if (targetCenterX !== null) {
        nextNodes = nextNodes.map((node) => {
          if (!mainlineNodeIds.has(node.id)) return node;
          const size = resolveNodeSize(node);
          return {
            ...node,
            position: {
              x: targetCenterX - size.width / 2,
              y: node.position.y
            }
          };
        });
      }

      if (decisionNodeIds.length) {
        const adjacency = new Map();
        currentEdges.forEach((edge) => {
          if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
          adjacency.get(edge.source).push(edge.target);
        });

        const collectDescendants = (startId) => {
          const visited = new Set();
          const queue = [startId];
          while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            const next = adjacency.get(id) || [];
            next.forEach((target) => {
              if (!visited.has(target)) queue.push(target);
            });
          }
          return visited;
        };

        const getNodeMap = () => new Map(nextNodes.map((node) => [node.id, node]));

        decisionNodeIds.forEach((decisionId) => {
          const nodeById = getNodeMap();
          const decisionNode = nodeById.get(decisionId);
          if (!decisionNode) return;
          const decisionSize = resolveNodeSize(decisionNode);
          const decisionCenterX = decisionNode.position.x + decisionSize.width / 2;
          const customBranchOffset =
            typeof decisionNode.data?.branchOffset === "number" ? decisionNode.data.branchOffset : null;
          const defaultBranchOffset =
            customBranchOffset ??
            (DECISION_NODE_SIZE / 2 + ACTION_NODE_WIDTH / 2 + LAYOUT_CONFIG.nodesep);

          [
            { handle: "no", direction: -1 },
            { handle: "yes", direction: 1 }
          ].forEach(({ handle, direction }) => {
            const handleOffset =
              decisionNode.data?.branchOffsetByHandle &&
              typeof decisionNode.data.branchOffsetByHandle[handle] === "number"
                ? decisionNode.data.branchOffsetByHandle[handle]
                : null;
            const branchOffset = handleOffset ?? defaultBranchOffset;
            const junctionId = `junction-${decisionId}-${handle}`;
            const junctionNode = nodeById.get(junctionId);
            if (!junctionNode) return;
            const junctionSize = resolveNodeSize(junctionNode);
            const junctionCenterX = junctionNode.position.x + junctionSize.width / 2;
            const desiredCenterX = decisionCenterX + direction * branchOffset;
            const deltaX = desiredCenterX - junctionCenterX;
            if (Math.abs(deltaX) < 1) return;
            const branchIds = collectDescendants(junctionId);
            nextNodes = nextNodes.map((node) => {
              if (!branchIds.has(node.id)) return node;
              return {
                ...node,
                position: {
                  x: node.position.x + deltaX,
                  y: node.position.y
                }
              };
            });
          });
        });
      }

      const alignableNodes = nextNodes.filter(
        (node) => node.data?.alignWith && node.data?.alignPhase !== "post"
      );
      if (alignableNodes.length) {
        const nodeById = new Map(nextNodes.map((node) => [node.id, node]));
        nextNodes = nextNodes.map((node) => {
          const targetId = node.data?.alignWith;
          if (!targetId) return node;
          const target = nodeById.get(targetId);
          if (!target) return node;
          const nodeSize = resolveNodeSize(node);
          const targetSize = resolveNodeSize(target);
          const targetCenterY = target.position.y + targetSize.height / 2;
          const offset = typeof node.data?.alignOffset === "number" ? node.data.alignOffset : 0;
          return {
            ...node,
            position: {
              x: node.position.x,
              y: targetCenterY + offset - nodeSize.height / 2
            }
          };
        });
      }

      const branchAlignedDecisions = decisionNodeIds
        .map((id) => {
          const node = nextNodes.find((candidate) => candidate.id === id);
          return node && node.data?.branchAlign ? node : null;
        })
        .filter(Boolean);

      if (branchAlignedDecisions.length) {
        const adjacency = new Map();
        currentEdges.forEach((edge) => {
          if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
          adjacency.get(edge.source).push(edge.target);
        });

        const nodeById = () => new Map(nextNodes.map((node) => [node.id, node]));
        const offsetCache = new Map();

        const resolveOffsets = (decisionNode) => {
          const explicitJunction = decisionNode.data?.branchJunctionOffset;
          const explicitTarget = decisionNode.data?.branchTargetOffset;
          if (typeof explicitJunction === "number" && typeof explicitTarget === "number") {
            return { junctionOffset: explicitJunction, targetOffset: explicitTarget };
          }
          const refId = decisionNode.data?.branchAlignRef;
          if (!refId) return null;
          if (offsetCache.has(refId)) return offsetCache.get(refId);
          const refNode = nodeById().get(refId);
          if (!refNode) return null;
          const refSize = resolveNodeSize(refNode);
          const refCenterY = refNode.position.y + refSize.height / 2;
          const offsets = [];
          ["yes", "no"].forEach((handle) => {
            const junctionId = `junction-${refId}-${handle}`;
            const junctionNode = nodeById().get(junctionId);
            if (!junctionNode) return;
            const junctionSize = resolveNodeSize(junctionNode);
            const junctionCenterY = junctionNode.position.y + junctionSize.height / 2;
            const targets = adjacency.get(junctionId) || [];
            const targetNode = targets.length ? nodeById().get(targets[0]) : null;
            if (!targetNode) return;
            const targetSize = resolveNodeSize(targetNode);
            const targetCenterY = targetNode.position.y + targetSize.height / 2;
            offsets.push({
              junctionOffset: junctionCenterY - refCenterY,
              targetOffset: targetCenterY - refCenterY
            });
          });
          if (!offsets.length) return null;
          const averaged = {
            junctionOffset:
              offsets.reduce((sum, item) => sum + item.junctionOffset, 0) / offsets.length,
            targetOffset:
              offsets.reduce((sum, item) => sum + item.targetOffset, 0) / offsets.length
          };
          offsetCache.set(refId, averaged);
          return averaged;
        };

        const collectDescendants = (startId) => {
          const visited = new Set();
          const queue = [startId];
          while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            const next = adjacency.get(id) || [];
            next.forEach((target) => {
              if (!visited.has(target)) queue.push(target);
            });
          }
          return visited;
        };

        branchAlignedDecisions.forEach((decisionNode) => {
          const offsets = resolveOffsets(decisionNode);
          if (!offsets) return;
          const branchAlignMode = decisionNode.data?.branchAlign;
          const junctionOnly =
            branchAlignMode === "junction" ||
            branchAlignMode === "junctionOnly" ||
            branchAlignMode === "junction-only";
          const decisionSize = resolveNodeSize(decisionNode);
          const decisionCenterY = decisionNode.position.y + decisionSize.height / 2;
          const desiredJunctionCenterY = decisionCenterY + offsets.junctionOffset;
          const desiredTargetCenterY = decisionCenterY + offsets.targetOffset;

          ["yes", "no"].forEach((handle) => {
            const junctionId = `junction-${decisionNode.id}-${handle}`;
            const currentNodeById = nodeById();
            const junctionNode = currentNodeById.get(junctionId);
            if (!junctionNode) return;
            const targets = adjacency.get(junctionId) || [];
            const targetNode = targets.length ? currentNodeById.get(targets[0]) : null;
            if (!targetNode) return;
            const targetSize = resolveNodeSize(targetNode);
            const currentTargetCenterY = targetNode.position.y + targetSize.height / 2;
            const delta = desiredTargetCenterY - currentTargetCenterY;
            if (!junctionOnly && Math.abs(delta) > 0.5) {
              const branchIds = collectDescendants(junctionId);
              nextNodes = nextNodes.map((node) => {
                if (!branchIds.has(node.id)) return node;
                return {
                  ...node,
                  position: {
                    x: node.position.x,
                    y: node.position.y + delta
                  }
                };
              });
            }
            const updatedNodeById = nodeById();
            const updatedJunction = updatedNodeById.get(junctionId);
            if (!updatedJunction) return;
            const junctionSize = resolveNodeSize(updatedJunction);
            const currentJunctionCenterY = updatedJunction.position.y + junctionSize.height / 2;
            const junctionDelta = desiredJunctionCenterY - currentJunctionCenterY;
            if (Math.abs(junctionDelta) > 0.5) {
              nextNodes = nextNodes.map((node) => {
                if (node.id !== junctionId) return node;
                return {
                  ...node,
                  position: {
                    x: node.position.x,
                    y: node.position.y + junctionDelta
                  }
                };
              });
            }
          });
        });
      }

      const postAlignedNodes = nextNodes.filter(
        (node) => node.data?.alignWith && node.data?.alignPhase === "post"
      );
      if (postAlignedNodes.length) {
        const nodeById = new Map(nextNodes.map((node) => [node.id, node]));
        nextNodes = nextNodes.map((node) => {
          if (!node.data?.alignWith || node.data?.alignPhase !== "post") return node;
          const target = nodeById.get(node.data.alignWith);
          if (!target) return node;
          const nodeSize = resolveNodeSize(node);
          const targetSize = resolveNodeSize(target);
          const targetCenterY = target.position.y + targetSize.height / 2;
          const offset = typeof node.data?.alignOffset === "number" ? node.data.alignOffset : 0;
          return {
            ...node,
            position: {
              x: node.position.x,
              y: targetCenterY + offset - nodeSize.height / 2
            }
          };
        });
      }

      const annotationEdges = currentEdges.filter((edge) => edge.data?.isAnnotation);
      if (annotationEdges.length) {
        const notePositions = new Map();
        const nodeById = new Map(nextNodes.map((node) => [node.id, node]));
        const annotationOffset = 36;

        annotationEdges.forEach((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return;
          const sourceSize = resolveNodeSize(source);
          const targetSize = resolveNodeSize(target);
          const noteSide = target.data?.notePosition === "left" ? "left" : "right";
          const noteX =
            noteSide === "left"
              ? source.position.x - targetSize.width - annotationOffset
              : source.position.x + sourceSize.width + annotationOffset;
          notePositions.set(target.id, {
            x: noteX,
            y: source.position.y + sourceSize.height / 2 - targetSize.height / 2
          });
        });

        if (notePositions.size) {
          nextNodes = nextNodes.map((node) => {
            const position = notePositions.get(node.id);
            if (!position) return node;
            return { ...node, position };
          });
        }
      }

      setNodes(nextNodes);

      if (recenter && flowWrapperRef.current) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        nextNodes.forEach((node) => {
          const size = resolveNodeSize(node);
          minX = Math.min(minX, node.position.x);
          minY = Math.min(minY, node.position.y);
          maxX = Math.max(maxX, node.position.x + size.width);
          maxY = Math.max(maxY, node.position.y + size.height);
        });

        if (Number.isFinite(minX)) {
          const rect = flowWrapperRef.current.getBoundingClientRect();
          const zoom = DEFAULT_ZOOM;
          const centerX = (minX + maxX) / 2;
          const topPadding = 16;
          const x = rect.width / 2 - centerX * zoom;
          const y = topPadding - minY * zoom;
          setViewport({ x, y, zoom }, { duration: 0 });
          autoCenteredRef.current = true;
        }
      }
    },
    [
      decisionNodeId,
      decisionNodeIds,
      getEdges,
      getNodes,
      mainlineNodeIds,
      resolveNodeSize,
      setNodes,
      setViewport
    ]
  );

  useEffect(() => {
    if (!nodesInitialized) return;
    applyLayout({ recenter: !autoCenteredRef.current });
  }, [applyLayout, nodesInitialized, processKey]);

  useEffect(() => {
    if (!nodesInitialized) return;
    let frame;
    const handleResize = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyLayout());
    };
    window.addEventListener("resize", handleResize);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [applyLayout, nodesInitialized]);

  const layoutBounds = useMemo(() => {
    if (!nodes.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const size = resolveNodeSize(node);
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + size.width);
      maxY = Math.max(maxY, node.position.y + size.height);
    });

    return { minX, minY, maxX, maxY };
  }, [nodes, resolveNodeSize]);

  const translateExtent = useMemo(() => {
    if (!layoutBounds) return undefined;
    const margin = 240;
    return [
      [layoutBounds.minX - margin, layoutBounds.minY - margin],
      [layoutBounds.maxX + margin, layoutBounds.maxY + margin]
    ];
  }, [layoutBounds]);

  const contentBounds = useMemo(() => {
    if (!layoutBounds) return null;
    return {
      x: layoutBounds.minX,
      y: layoutBounds.minY,
      width: layoutBounds.maxX - layoutBounds.minX,
      height: layoutBounds.maxY - layoutBounds.minY
    };
  }, [layoutBounds]);

  const renderNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedNodeId
      }
    }));
  }, [nodes, selectedNodeId]);

  const renderEdges = useMemo(() => {
    return edges.map((edge) => {
      const isActive =
        selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
      const classes = [edge.className, isActive ? "pf-edge--active" : ""]
        .filter(Boolean)
        .join(" ");
      return {
        ...edge,
        className: classes
      };
    });
  }, [edges, selectedNodeId]);

  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const onNodeClick = useCallback((event, node) => {
    event.stopPropagation();
    if (node.data?.isJunction || node.data?.isNote || node.type === "note") return;
    setSelectedNodeId(node.id);
  }, []);

  return (
    <>
      <div className="process-flow-controls" aria-hidden="true" />
      <div
        className={`process-flow-body ${
          viewMode === "flow" ? "process-flow-body--flow" : "process-flow-body--steps"
        }`}
      >
        {viewMode === "steps" ? (
          <div className="process-flow-list-panel">
            <StepList
              processData={processData}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        ) : (
          <div className="process-flow-canvas" ref={flowWrapperRef}>
            <ReactFlow
              nodes={renderNodes}
              edges={renderEdges}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              zoomOnScroll
              zoomOnPinch
              defaultViewport={{ x: 0, y: 0, zoom: DEFAULT_ZOOM }}
              minZoom={0.7}
              maxZoom={2.5}
              translateExtent={translateExtent}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNodeId(null)}
            >
              <FlowViewportOverlay bounds={contentBounds} />
            </ReactFlow>
          </div>
        )}
        <div
          className={`process-flow-side${viewMode === "steps" ? " process-flow-side--sticky" : ""}`}
        >
          <FlowDrawer node={selectedNode ? selectedNode.data : null} />
          <StepScreenshots processData={processData} node={selectedNode ? selectedNode.data : null} />
        </div>
      </div>
    </>
  );
};


export default function RunbookDetailClient({ processId }) {
  const [processRef, setProcessRef] = useState(null);
  const [processData, setProcessData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [viewMode, setViewMode] = useState('flow');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setStatus('loading');
      setProcessRef(null);
      setProcessData(null);
      try {
        const listRes = await fetch('/api/runbook/processes', { cache: 'no-store' });
        if (!listRes.ok) throw new Error('Failed to load process list');
        const list = processListFromResponse(await listRes.json());
        const wanted = normalizeProcessId(processId);
        const match = list.find((item) => {
          const definitionName = String(item.definition || '').split('/').pop();
          return normalizeProcessId(item.id) === wanted || normalizeProcessId(definitionName) === wanted;
        });
        if (!match) throw new Error('Process not found');
        const detailRes = await fetch(match.definition, { cache: 'no-store' });
        if (!detailRes.ok) throw new Error(`Failed to load ${match.definition}`);
        const detail = await detailRes.json();
        if (!ignore) {
          setProcessRef(match);
          setProcessData(detail);
          setViewMode('flow');
          setStatus('ready');
        }
      } catch (error) {
        console.error('[runbook] detail load failed', error);
        if (!ignore) setStatus('error');
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [processId]);

  if (status === 'loading') {
    return <div className="process-flow-empty">Loading process flow...</div>;
  }

  if (status === 'error' || !processRef || !processData) {
    return <div className="process-flow-empty">Unable to load the process flow.</div>;
  }

  return (
    <div className="process-flow-detail runbook-detail-page">
      <div className="process-flow-detail-header">
        <Link href="/runbook" className="btn small runbook-back-link">Back to list</Link>
        <h2>{processData.process?.title || processRef.title}</h2>
        {processData.process?.description ? <p className="muted">{processData.process.description}</p> : null}
        {processData.process?.usedWhen ? (
          <p className="muted"><strong>Used when:</strong> {processData.process.usedWhen}</p>
        ) : null}
        <div className="process-flow-view-toggle">
          <label htmlFor="process-flow-view">View</label>
          <select id="process-flow-view" value={viewMode} onChange={(event) => setViewMode(event.target.value)} className="input-themed px-2 py-1 rounded text-sm">
            <option value="flow">Flowchart</option>
            <option value="steps">Step List</option>
          </select>
        </div>
      </div>
      <ReactFlowProvider>
        <FlowShell processData={processData} viewMode={viewMode} />
      </ReactFlowProvider>
    </div>
  );
}
