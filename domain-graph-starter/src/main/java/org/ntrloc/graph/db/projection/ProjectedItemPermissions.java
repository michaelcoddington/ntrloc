package org.ntrloc.graph.db.projection;

import org.springframework.lang.Nullable;

import java.util.Map;

// edit mirrors ProjectedItem.properties' own nested shape exactly (Map<String,Object>, a leaf
// value or a further nested Map) rather than a flat dotted-path list, so a client already walking
// properties can walk edit the same way. Each node carries two independently-optional keys:
// "scalars" -- a List<String> of this node's own directly-writable scalar leaf names, or the
// single literal "*" (never a real property name -- see the property-name grammar) meaning every
// scalar leaf at this level is writable; and "objects" -- a Map<String, Object> from a child
// OBJECT property's name to its own same-shaped node, present only for a child that has *some*
// writable property (scalar or nested) beneath it. A node with neither key is never emitted --
// omission from edit means "not writable," the same convention filterPropertiesByReadGrant already
// uses for read. Deliberately NOT collapsed further than this (no "objects": "*" shortcut for a
// fully-writable subtree, even though the tree-walk needed to discover that is identical either
// way) -- a value's shape (string vs. further object) would otherwise depend on how *complete* a
// grant happens to be, which is exactly the ambiguity this shape exists to avoid.
//
// No separate superuser flag: a superuser's edit is the real, fully-enumerated tree (every node's
// "scalars" is "*", every OBJECT child present), same code path as everyone else -- one shape for
// every principal, at the cost of walking (and returning) the whole schema tree even though the
// answer is always "everything." Chosen deliberately over a cheaper wildcard/flag shortcut,
// consistent with the rest of this design: a value's meaning should never depend on which
// principal is asking.
public record ProjectedItemPermissions(@Nullable Map<String, Object> edit, boolean delete) {}
