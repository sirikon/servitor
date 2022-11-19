import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

export default () => {
  return (
    <>
      <header>
        <h1>
          <Link to={"/"}>servitor</Link>
        </h1>
        <p>
          <NavLink to={"/"}>jobs</NavLink>
          <NavLink to={"/seed"}>seed</NavLink>
        </p>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <p>
          <span>servitor v0.0.0</span>
          <span> | </span>
          <a href="https://github.com/sirikon/servitor" target="_blank">
            sources
          </a>
        </p>
      </footer>
    </>
  );
};
