# Project 3 Write-up — Rising Seas

## Motivation

Our main question is: **How much higher will the ocean sit by 2100, and which coastal regions are projected to experience the largest relative rise?** We focused on sea level rise because it is a long-term climate signal that affects flooding, storm surge, and coastal exposure. Instead of framing the project as “tsunami risk,” the final framing is about the rising baseline that makes coastal hazards more damaging.

The map gives a geographic overview, while the side panel and line chart let viewers inspect one country at a time. This combination helps show both spatial variation across ocean basins and temporal change from 2024 to 2100.

## Design rationale

Countries are colored by projected sea level rise in centimeters above the 1995–2014 baseline. A sequential yellow-to-red color scale was chosen because larger values represent more severe projected rise. Gray indicates countries with no projection data in the processed file, so missing data is not confused with low risk.

The main interactions are basin filtering, metric switching, search, hover/click inspection, zooming, and reset view. Clicking or hovering a country updates the side panel with the country’s projected rise, basin, elevation, population context, and a D3 line chart. The line chart compares the selected country trajectory against the global mean, which makes regional deviations easier to see.

We considered making the map the only visualization, but that made it too hard to understand change over time. We also considered using only a line chart, but that removed the geographic pattern. The final design combines a map for spatial comparison with a line chart for temporal comparison.

## Data and transformations

The visualization uses a processed JSON file generated from CMIP6 sea-level-rise outputs under SSP5-8.5. Sea level rise values are shown in centimeters relative to the 1995–2014 baseline. The country map uses boundary geometry only; the climate values come from the project’s local JSON file.

Population and coastal elevation are included as supporting context rather than CMIP6 variables. Before the final submission, the team should verify those external context sources and cite them clearly if they remain in the visualization. Countries with no projection data in the processed JSON are shown in gray rather than assigned a made-up value.

## Development process

The team split the work across data processing, D3 implementation, styling, and write-up. The data-processing work involved querying CMIP6 outputs, converting the relevant sea-level-rise series into a smaller JSON file, and checking which countries had usable projection values. The D3 work involved building the map, linking country hover/click events to the side panel, adding basin filters and search, and drawing the trajectory chart.

The most time-consuming parts were debugging the data pipeline and making the interactions feel connected. In particular, the side panel needed to update consistently when users clicked a country, searched for a country, or filtered by ocean basin. The final prototype is designed to be narrow enough to work reliably but interactive enough to support exploration.
