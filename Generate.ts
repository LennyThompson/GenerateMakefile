import * as fs from "fs";
import * as path from "path";
import * as lodash from "lodash";
import {WriteStream} from "fs";


const SOURCE_FILES: string = "SOURCE_FILES";
const MF_SET: string = "set";
const MF_ADD_SUBDIRECTORY: string = "add_subdirectory";
const MF_INCLUDE_DIRECTORIES: string = "include_directories";
const MF_TARGET_LINK_LIBRARIES: string = "target_link_libraries";
const MF_CMAKE_MINIMUM_REQUIRED: string = "cmake_minimum_required";
const MF_PROJECT: string = "project";

const VERSION_3_5: string = "VERSION 3.5";
const CMAKE_CXX_STANDARD_11: string = "CMAKE_CXX_STANDARD 11";
const CMAKE_CXX_STANDARD_14: string = "CMAKE_CXX_STANDARD 14";
const CMAKE_VERBOSE_MAKEFILE: string = "CMAKE_VERBOSE_MAKEFILE ON";
const CMAKE_CXX_FLAGS: string = "CMAKE_CXX_FLAGS";
const CMAKE_C_FLAGS: string = "CMAKE_C_FLAGS";

const INDENT: string = "     ";

export interface Options
{
    root: string;
    excludeDirs?: string[];
    excludeFiles?: string[];
}

export interface MakeStructure
{
    isRoot: boolean;
    dirName: string;

    buildFiles: string[];
    includeFiles: string[];
    subMake: MakeStructure[];

    buildMakeFile(): boolean;
    libraryName: string;
}

class MakeStructureImpl implements MakeStructure
{
    isRoot: boolean;
    dirName: string;

    buildFiles: string[];
    includeFiles: string[];
    subMake: MakeStructure[];

    get libraryName(): string
    {
        if(this.isRoot)
        {
            return "****root make****"
        }
        return "lib_" + this.dirName.toLowerCase();
    }

    buildMakeFile(): boolean
    {
        let bWritten: boolean = false;
        let stream: WriteStream = fs.createWriteStream(path.join(this.options.root, "CMakeLists.txt"));

        if(this.isRoot)
        {
            stream.write(MF_CMAKE_MINIMUM_REQUIRED + "(" + VERSION_3_5 + ")\n");
            stream.write(MF_PROJECT + "(" + this.dirName + "_cmake" + ")\n");

            stream.write(MF_SET + "(" + CMAKE_CXX_STANDARD_11 + ")\n");
            stream.write(MF_SET + "(" + CMAKE_VERBOSE_MAKEFILE + ")\n");
            stream.write(MF_SET + "(" + CMAKE_CXX_FLAGS + "${CMAKE_CXX_FLAGS} -m32" + ")\n");
            stream.write(MF_SET + "(" + CMAKE_C_FLAGS + "${CMAKE_C_FLAGS} -m32" + ")\n");

            stream.write(MF_INCLUDE_DIRECTORIES + "(" + "${PROJECT_SOURCE_DIR}" + ")\n");
        }

        if(!lodash(this.buildFiles).isUndefined())
        {
            let strIndent: string = INDENT;
            stream.write(MF_SET + "(" + SOURCE_FILES + "\n");
            strIndent += INDENT;
            lodash(this.buildFiles)
                .forEach(
                    file =>
                    {
                        stream.write(strIndent + file + "\n");
                    }
                );
            strIndent = INDENT;
            stream.write(strIndent + ")\n");
            bWritten = true;
        }

        if(!lodash(this.subMake).isUndefined())
        {
            lodash(this.subMake)
                .forEach(
                    (makeCandidate: MakeStructure) =>
                    {
                        stream.write(MF_ADD_SUBDIRECTORY + "(" + makeCandidate.dirName + ")\n");
                        stream.write(MF_INCLUDE_DIRECTORIES + "(" + makeCandidate.dirName + ")\n");
                        stream.write(MF_TARGET_LINK_LIBRARIES + "(${PROJECT_NAME} " + makeCandidate.libraryName + ")\n");
                        stream.write("\n");
                    }
                )
            bWritten = true;
        }
        stream.end();

        lodash(this.subMake)
            .forEach(
                (makeCandidate: MakeStructure) => makeCandidate.buildMakeFile()
            );

        return bWritten;
    }


    constructor(strDirName: string, private options: Options)
    {
        this.initMakePath();
        this.isRoot = strDirName ? false : true;
        this.dirName = strDirName;
    }

    private initMakePath(): boolean
    {
        if (this.isValidPath(this.options.root))
        {
            fs.readdirSync(this.options.root).filter(file =>
                {
                    if(this.isValidPath(path.join(this.options.root, file)))
                    {
                        if(!this.isDirectoryExcluded(file))
                        {
                            if (!this.subMake)
                            {
                                this.subMake = [];
                            }
                            let subOptions: Options = lodash(this.options).clone();
                            subOptions.root = path.join(this.options.root, file);
                            this.subMake.push(new MakeStructureImpl(file, subOptions));
                        }
                    }
                    else
                    {
                        if (file.match(/.+\.cpp$/ig))
                        {
                            if (!this.buildFiles)
                            {
                                this.buildFiles = [];
                            }
                            console.log(file);
                            this.buildFiles.push(file);
                        }
                        else if (file.match(/.+\.h$/ig))
                        {
                            if (!this.includeFiles)
                            {
                                this.includeFiles = [];
                            }
                            console.log(file);
                            this.includeFiles.push(file);
                        }
                    }

                }
            );
            return true;
        }

        return false;
    }

    private isValidPath(strPath: string): boolean
    {
        return fs.existsSync(strPath)
            &&
            fs.statSync(strPath).isDirectory();
    }

    private isDirectoryExcluded(strDir: string): boolean
    {
        if(this.options.excludeDirs)
        {
            return !lodash(lodash(this.options.excludeDirs).find((dir) => dir === strDir)).isUndefined();
        }
        return false;
    }
}

export class MakeFileGenerator
{
    constructor(private options: Options)
    {
    }

    generate(): MakeStructure
    {
        if (fs.existsSync(this.options.root))
        {
            return this.buildMakeFileCandidates();
        }
        return null;
    }

    buildMakeFileCandidates(): MakeStructure
    {
        return new MakeStructureImpl(null, this.options);
    }
}


export default (options: Options) =>
{
    let generator: MakeFileGenerator = new MakeFileGenerator(options);
    let makeStructure: MakeStructure = generator.generate();

    if(makeStructure)
    {
        makeStructure.buildMakeFile();
    }
}