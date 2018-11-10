/* eslint-disable no-console */
import React, { Component } from "react";

import './App.css';

import ColorPicker from "./ColorPicker";

class App extends Component {
    constructor(props) {
        super(props);
        let initialValue = {
            '@primary-color': '#1987a7',
            '@secondary-color': '#0000ff'
        };
        let vars = {};

        try {
            vars = Object.assign({}, initialValue, JSON.parse(localStorage.getItem('app-theme')));
        } finally {
            this.state = { vars, initialValue };
            window.less
                .modifyVars(vars)
                .then(() => { })
                .catch(error => {
                    console.error(`Failed to update theme`);
                });
        }
    }
    onChangeComplete = (varName, color) => {
        const { vars } = this.state;
        vars[varName] = color;
        this.setState({ vars });
    };
    handleColorChange = (varname, color) => {
        const { vars } = this.state;
        if (varname) vars[varname] = color;
        console.log(vars);
        window.less
            .modifyVars(vars)
            .then(() => {
                this.setState({ vars });
                localStorage.setItem("app-theme", JSON.stringify(vars));
            })
            .catch(error => {
                console.error(`Failed to update theme`);
            });
    };

    getColorPicker = (varName) => (
        <div
            key={varName}
            className="item">
            <div>
                {varName}
            </div>
            <div>
                <ColorPicker
                    type="sketch"
                    small
                    color={this.state.vars[varName]}
                    position="bottom"
                    presetColors={[
                        '#F5222D',
                        '#FA541C',
                        '#FA8C16',
                        '#FAAD14',
                        '#FADB14',
                        '#A0D911',
                        '#52C41A',
                        '#13C2C2',
                        '#1890FF',
                        '#2F54EB',
                        '#722ED1',
                        '#EB2F96',
                    ]}
                    onChangeComplete={color => this.handleColorChange(varName, color)}
                />
            </div>
        </div>
    )
    resetTheme = () => {
        localStorage.setItem('app-theme', '{}');
        this.setState({ vars: this.state.initialValue });
        window.less
            .modifyVars(this.state.initialValue)
            .catch(error => {
                console.error(`Failed to reset theme`);
            });
    }

    render() {
        const colorPickers = Object.keys(this.state.vars).map(varName => this.getColorPicker(varName));
        return (
            <div className="App">
                <div className="color-wrapper">
                    <div className="title primary">
                        Theme
                    </div>
                    <div className="wrapper-body">
                        {colorPickers}
                    </div>
                </div>
                <div className="container">
                    <div className="btn-group">
                        <button
                            type="button"
                            className="btn btn-default">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary">
                            Submit
                        </button>
                    </div>
                    <div className="secondary-color">
                        color : @secondary-color;
                    </div>
                </div>
            </div>
        );
    }
}

export default App
