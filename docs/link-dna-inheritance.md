# Link DNA inheritance

Every QR Code separates identity into three deterministic scopes. They are not unrelated hashes;
the renderer assigns each visual decision to the narrowest scope that should own it.

| Scope    | Input                                                        | Owns                                                     |
| -------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `family` | Registrable domain, resolved with the Public Suffix List     | Species, recipe, name, and the dominant structural genes |
| `site`   | Full hostname, including subdomain                           | A bounded structural variant and site-level details      |
| `page`   | Normalized URL without fragments or tracking-only query keys | Optional page imprint when `identityScope="url"`         |

Private suffixes are enabled. For example, `project.github.io` is its own family, while
`blog.example.co.uk` and `shop.example.co.uk` inherit from `example.co.uk`.

## Model ownership

Tree and Terrain apply the hierarchy as follows:

- `family` chooses the model recipe, structural family, palette family, and generated name;
- model proportions mix 82% family shape with 18% site or page detail;
- morph structure mixes 78% family structure with 22% site or page detail;
- QR modules always encode the exact payload URL, so changing a page still changes the QR field;
- theme, atmosphere, light/dark mode, view, export, and sound never enter Link DNA.

The bounded mix gives subdomains visible individuality without making them unrelated species.
Different root domains receive independent family structure even if they happen to select the same
high-level recipe.

## Behavioral gates

The protocol and renderer tests enforce these properties:

1. Public suffix parsing groups domain families correctly.
2. Pages on one hostname keep site DNA while preserving page-specific QR payloads.
3. A set of subdomains has a lower average morph distance than unrelated root domains.
4. Subdomains keep the same recipe and generated family name.
5. Presentation controls can update without regenerating identity or baked geometry.

Future scenes should reuse these scopes rather than inventing scene-specific URL parsing. New genes
must use named channels and declare whether they are family structure, site variation, page imprint,
or presentation-only state.
