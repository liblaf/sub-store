# Subscription Configuration

This context describes the entries combined into published Mihomo and Stash subscription configurations.

## Language

**Provider Proxy**:
An entry supplied by an upstream subscription, whether or not it is ultimately suitable for routing.
_Avoid_: Node, outbound

**Info Proxy**:
A generated display-only entry that conveys subscription quota, expiry, or refresh information and is never eligible for routing.
_Avoid_: Info node, metadata proxy, display proxy
