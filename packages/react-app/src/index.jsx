import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";
import React from "react";
import { ThemeSwitcherProvider } from "react-css-theme-switcher";
import { TokensContextProvider } from "./components";
import ReactDOM from "react-dom";
import App from "./App";
import "./index.css";

const themes = {
  dark: `${process.env.PUBLIC_URL}/dark-theme.css`,
  light: `${process.env.PUBLIC_URL}/light-theme.css`,
};

const prevTheme = window.localStorage.getItem("theme");

const subgraphUri = process.env.REACT_APP_SUBGRAPH_ENDPOINT || "http://localhost:8000/subgraphs/name/tokenstreams/org-factory";

const client = new ApolloClient({
  uri: subgraphUri,
  cache: new InMemoryCache(),
});

ReactDOM.render(
  <TokensContextProvider>
    <ApolloProvider client={client}>
      <ThemeSwitcherProvider themeMap={themes} defaultTheme={prevTheme || "dark"}>
        <App subgraphUri={subgraphUri} />
      </ThemeSwitcherProvider>
    </ApolloProvider>
  </TokensContextProvider>,
  document.getElementById("root"),
);
