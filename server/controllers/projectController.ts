import {Request, Response } from 'express'
import * as Sentry from "@sentry/node";
import { prisma } from '../configs/prisma.js';
import {v2 as cloudinary } from 'cloudinary'
import path from 'path';

// Folder that holds the fixed output files (UGC1/client/src/assets, relative to /server).
// The model/product input files live in UGC1/client/source/set<N>/ for easy uploading,
// but the server only reads the generated outputs from here.
const ASSETS_DIR = path.join(process.cwd(), '..', 'client', 'src', 'assets');

// Fixed output sets used instead of calling the Gemini / Veo APIs.
// The set is chosen from the uploaded model image filename:
//   model1.* -> set "1", model2.* -> set "2", model3.* -> set "3", model4.* -> set "4"
const OUTPUT_SETS: Record<string, { image: string; video: string }> = {
    '1': { image: 'output1.jpg', video: 'output1.mp4' },
    '2': { image: 'output2.jpg', video: 'output2.mp4' },
    '3': { image: 'output3.jpg', video: 'output3.mp4' },
    '4': { image: 'output4.png', video: 'output4.mp4' },
};

// Fallback set used when the uploaded model file doesn't match model1/2/3/4
const DEFAULT_VARIANT = '3';

// Detect which output set to use based on the uploaded model file name (e.g. "model2.png" -> "2")
const detectVariant = (modelFileName: string = ''): string => {
    const match = modelFileName.match(/model\s*(\d+)/i);
    const variant = match?.[1];
    return variant && OUTPUT_SETS[variant] ? variant : DEFAULT_VARIANT;
};

export const createProject = async (req:Request, res: Response) => {
    let tempProjectId: string;
    const { userId } = req.auth();
    let isCreditDeducted = false;

    const {name = 'New Project', aspectRatio, userPrompt, productName, productDescription, targetLength = 5} = req.body;

    const images: any = req.files;

    if(images.length < 2 || !productName){
        return res.status(400).json({message: 'Please upload at least 2 images'})
    }

    const user = await prisma.user.findUnique({
        where: {id: userId}
    })

    if(!user || user.credits < 5){
        return res.status(401).json({message: 'Insufficient credits'})
    }else{
        // deduct credits for image generation
        await prisma.user.update({
            where: {id: userId},
            data: {credits: {decrement: 5}}
        }).then(()=>{isCreditDeducted = true});
    }

    try {

        let uploadedImages = await Promise.all(
            images.map(async(item: any)=>{
                let result = await cloudinary.uploader.upload(item.path, {resource_type: 'image'});
                return result.secure_url
            })
        )

         // The frontend sends [productImage, modelImage]; pick the output set from the model file name
         const variant = detectVariant(images[1]?.originalname);

         const project = await prisma.project.create({
            data: {
                name,
                userId,
                productName,
                productDescription,
                userPrompt,
                aspectRatio,
                targetLength: parseInt(targetLength),
                uploadedImages,
                variant,
                isGenerating: true
            }
         })

         tempProjectId = project.id;

         // Instead of calling the Gemini API, use the fixed local output image for this set
         const imageOutput = path.join(ASSETS_DIR, OUTPUT_SETS[variant].image);
         const uploadResult = await cloudinary.uploader.upload(imageOutput, {resource_type: 'image'});

         await prisma.project.update({
            where: {id: project.id},
            data: {
                generatedImage: uploadResult.secure_url,
                isGenerating: false
            }
         })

         res.json({projectId: project.id})
        
    } catch (error:any) {
        if(tempProjectId!){
            // update project status and error message
            await prisma.project.update({
                where: {id: tempProjectId},
                data: {isGenerating: false, error: error.message}
            })
        }

        if(isCreditDeducted){
            // add credits back
            await prisma.user.update({
                where: {id: userId},
                data: {credits: {increment: 5}}
            })
        }
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}


export const createVideo = async (req:Request, res: Response) => {
    const {userId} = req.auth()
    const { projectId } = req.body;
    let isCreditDeducted = false;

    const user = await prisma.user.findUnique({
        where: {id: userId}
    })

    if(!user || user.credits < 10){
        return res.status(401).json({ message: 'Insufficient credits' });
    }

    // deduct credits for video generation
    await prisma.user.update({
        where: {id: userId},
        data: {credits: {decrement: 10}}
    }).then(()=>{ isCreditDeducted = true} );

    try {
        const project = await prisma.project.findUnique({
            where: {id: projectId, userId},
            include: {user: true}
        })

        if(!project || project.isGenerating){
            return res.status(404).json({ message: 'Generation in progress' });
        }

        if(project.generatedVideo){
            return res.status(404).json({ message: 'Video already generated' });
        }

        await prisma.project.update({
            where: {id: projectId},
            data: {isGenerating: true}
        })

        if(!project.generatedImage){
            throw new Error('Generated image not found');
        }

        // Instead of calling the Veo API, use the fixed local output video for this project's set
        const variant = OUTPUT_SETS[project.variant] ? project.variant : DEFAULT_VARIANT;
        const videoOutput = path.join(ASSETS_DIR, OUTPUT_SETS[variant].video);
        const uploadResult = await cloudinary.uploader.upload(videoOutput, { resource_type: 'video' });

        await prisma.project.update({
            where: {id: project.id},
            data: {
                generatedVideo: uploadResult.secure_url,
                isGenerating: false
            }
        })

        res.json({message: 'Video generation completed', videoUrl: uploadResult.secure_url})
        
    } catch (error:any) {

            // update project status and error message
            await prisma.project.update({
                where: {id: projectId, userId},
                data: {isGenerating: false, error: error.message}
            })

         if(isCreditDeducted){
            // add credits back
            await prisma.user.update({
                where: {id: userId},
                data: {credits: {increment: 10}}
            })
        }

        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}

export const getAllPublishedProjects = async (req:Request, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            where: {isPublished: true}
        })
        res.json({projects})

    } catch (error:any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}

export const deleteProject = async (req:Request, res: Response) => {
    try {
        const { userId } = req.auth();
        const { projectId } = req.params;

        const project = await prisma.project.findUnique({
            where: {id: projectId, userId}
        })

         if (!project){
            return res.status(404).json({ message: 'Project not found' });
         }

         await prisma.project.delete({
            where: {id: projectId}
         })

         res.json({ message: 'Project deleted' });

    } catch (error:any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}